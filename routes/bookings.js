const express = require('express');
const router = express.Router();
const { dbQuery } = require('../database/db');

/**
 * Generate unique booking reference (e.g., BK-72941)
 */
function generateBookingRef() {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `BK-${randomNum}`;
}

/**
 * GET /api/bookings
 * Fetch all bookings with associated room details
 */
router.get('/', async (req, res) => {
  try {
    const { status, guest_search } = req.query;
    let sql = `
      SELECT b.*, r.room_number, r.room_type, r.price_per_night, r.image_url
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All') {
      sql += ' AND b.booking_status = ?';
      params.push(status);
    }

    if (guest_search && guest_search.trim() !== '') {
      sql += ' AND (b.guest_name LIKE ? OR b.guest_email LIKE ? OR b.booking_ref LIKE ? OR r.room_number LIKE ?)';
      const term = `%${guest_search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY b.created_at DESC';
    const rawBookings = await dbQuery.all(sql, params);
    const bookings = rawBookings.map(b => ({
      ...b,
      check_in: b.check_in_date,
      check_out: b.check_out_date,
      status: b.booking_status
    }));

    res.json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve bookings', error: error.message });
  }
});

/**
 * GET /api/bookings/:id
 * Retrieve specific booking by ID or Reference
 */
router.get('/:idOrRef', async (req, res) => {
  try {
    const param = req.params.idOrRef;
    const booking = await dbQuery.get(
      `SELECT b.*, r.room_number, r.room_type, r.price_per_night, r.amenities, r.image_url
       FROM bookings b
       JOIN rooms r ON b.room_id = r.id
       WHERE b.id = ? OR b.booking_ref = ?`,
      [param, param]
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: `Booking "${param}" not found.` });
    }

    const normalized = {
      ...booking,
      check_in: booking.check_in_date,
      check_out: booking.check_out_date,
      status: booking.booking_status
    };

    res.json({ success: true, booking: normalized });
  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving booking', error: error.message });
  }
});

/**
 * POST /api/bookings
 * Create a new booking with strict overlapping date validation
 */
router.post('/', async (req, res) => {
  try {
    const {
      room_id,
      guest_name,
      guest_email,
      guest_phone
    } = req.body;

    const check_in_date = req.body.check_in_date || req.body.check_in;
    const check_out_date = req.body.check_out_date || req.body.check_out;

    // 1. Basic field validation
    if (!room_id) {
      return res.status(400).json({ success: false, message: 'Please select a room to book.', error: 'Please select a room to book.' });
    }
    if (!guest_name || !guest_name.trim()) {
      return res.status(400).json({ success: false, message: 'Guest name is required.', error: 'Guest name is required.' });
    }
    if (!guest_email || !guest_email.trim() || !guest_email.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid guest email is required.', error: 'A valid guest email is required.' });
    }
    if (!check_in_date || !check_out_date) {
      return res.status(400).json({ success: false, message: 'Both Check-in and Check-out dates are required.', error: 'Both Check-in and Check-out dates are required.' });
    }

    const checkIn = new Date(check_in_date);
    const checkOut = new Date(check_out_date);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Expected YYYY-MM-DD.', error: 'Invalid date format. Expected YYYY-MM-DD.' });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date selection: Check-out date must be after Check-in date.',
        error: 'Invalid date selection: Check-out date must be after Check-in date.'
      });
    }

    // 2. Verify Room Existence and Maintenance Status
    const room = await dbQuery.get('SELECT * FROM rooms WHERE id = ?', [room_id]);
    if (!room) {
      return res.status(404).json({ success: false, message: `Room with ID ${room_id} does not exist.`, error: `Room with ID ${room_id} does not exist.` });
    }

    if (room.status === 'Maintenance') {
      return res.status(400).json({
        success: false,
        message: `Room ${room.room_number} is currently under maintenance and cannot be booked.`,
        error: `Room ${room.room_number} is currently under maintenance and cannot be booked.`
      });
    }

    // 3. Strict Date Overlap Validation:
    // Existing booking overlaps with requested interval if:
    // (existing.check_in < req.check_out) AND (existing.check_out > req.check_in)
    const overlappingBookings = await dbQuery.all(
      `SELECT * FROM bookings
       WHERE room_id = ?
         AND booking_status = 'CONFIRMED'
         AND check_in_date < ?
         AND check_out_date > ?`,
      [room_id, check_out_date, check_in_date]
    );

    if (overlappingBookings.length > 0) {
      const conflict = overlappingBookings[0];
      const conflictMsg = `Room ${room.room_number} is already booked for the selected dates! Conflict with active reservation (${conflict.booking_ref}: ${conflict.check_in_date} to ${conflict.check_out_date}). Please choose different dates or another room.`;
      return res.status(409).json({
        success: false,
        conflict: true,
        message: conflictMsg,
        error: conflictMsg,
        conflictingBooking: conflict
      });
    }

    // 4. Calculate Nights and Total Cost
    const diffTime = Math.abs(checkOut - checkIn);
    const totalNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const totalPrice = Number((totalNights * room.price_per_night).toFixed(2));
    const bookingRef = generateBookingRef();

    // 5. Insert Booking
    const insertResult = await dbQuery.run(
      `INSERT INTO bookings (booking_ref, room_id, guest_name, guest_email, guest_phone, check_in_date, check_out_date, total_nights, total_price, booking_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
      [
        bookingRef,
        room.id,
        guest_name.trim(),
        guest_email.trim(),
        guest_phone ? guest_phone.trim() : '',
        check_in_date,
        check_out_date,
        totalNights,
        totalPrice
      ]
    );

    const createdBooking = await dbQuery.get(
      `SELECT b.*, r.room_number, r.room_type, r.price_per_night, r.image_url
       FROM bookings b
       JOIN rooms r ON b.room_id = r.id
       WHERE b.id = ?`,
      [insertResult.lastID]
    );

    const normalizedCreated = {
      ...createdBooking,
      check_in: createdBooking.check_in_date,
      check_out: createdBooking.check_out_date,
      status: createdBooking.booking_status
    };

    res.status(201).json({
      success: true,
      message: `Reservation confirmed! Booking Reference: ${bookingRef}`,
      booking: normalizedCreated,
      ...normalizedCreated
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ success: false, message: 'Server error creating booking', error: error.message });
  }
});

/**
 * DELETE /api/bookings/:id
 * Cancel or Delete a booking record
 * Query param ?hard=true to completely delete record, default is cancellation status update
 */
router.delete('/:id', async (req, res) => {
  try {
    const bookingParam = req.params.id;

    // Check if booking exists by ID or booking_ref
    const booking = await dbQuery.get(
      `SELECT b.*, r.room_number
       FROM bookings b
       JOIN rooms r ON b.room_id = r.id
       WHERE b.id = ? OR b.booking_ref = ?`,
      [bookingParam, bookingParam]
    );

    // Edge Case: Cancelling a non-existent booking
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: `Booking with ID/Ref ${bookingParam} does not exist. Cannot cancel a non-existent booking.`,
        error: `Booking with ID/Ref ${bookingParam} does not exist.`
      });
    }

    if (req.query.hard === 'true') {
      await dbQuery.run('DELETE FROM bookings WHERE id = ?', [booking.id]);
      return res.json({
        success: true,
        message: `Booking #${booking.booking_ref} permanently removed from system.`
      });
    }

    // Edge Case: Cancelling an already cancelled booking
    if (booking.booking_status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: `Booking #${booking.booking_ref} is already cancelled.`,
        error: `Booking #${booking.booking_ref} is already cancelled.`
      });
    }

    // Perform cancellation
    await dbQuery.run(
      `UPDATE bookings SET booking_status = 'CANCELLED' WHERE id = ?`,
      [booking.id]
    );

    res.json({
      success: true,
      message: `Booking #${booking.booking_ref} for Room ${booking.room_number} has been successfully cancelled and the dates are released!`,
      bookingId: booking.id,
      bookingRef: booking.booking_ref,
      status: 'CANCELLED'
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel booking', error: error.message });
  }
});

module.exports = router;
