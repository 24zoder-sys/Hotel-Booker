const express = require('express');
const router = express.Router();
const { dbQuery } = require('../database/db');

/**
 * Search/Available rooms handler
 */
async function handleRoomSearch(req, res) {
  try {
    const { check_in, check_out, min_capacity, limit } = req.query;
    const room_type = req.query.room_type || req.query.type;

    if (!check_in || !check_out) {
      return res.status(400).json({
        success: false,
        message: 'Both check_in and check_out dates (YYYY-MM-DD) are required for searching available rooms.'
      });
    }

    const checkInDate = new Date(check_in);
    const checkOutDate = new Date(check_out);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use YYYY-MM-DD.'
      });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        success: false,
        message: 'Check-out date must be strictly after Check-in date.'
      });
    }

    // A room is BOOKED during [check_in, check_out] if:
    // booking.check_in_date < check_out AND booking.check_out_date > check_in
    let sql = `
      SELECT r.* FROM rooms r
      WHERE r.status != 'Maintenance'
        AND r.id NOT IN (
          SELECT b.room_id FROM bookings b
          WHERE b.booking_status != 'CANCELLED'
            AND b.check_in_date < ?
            AND b.check_out_date > ?
        )
    `;
    const params = [check_out, check_in];

    if (room_type && room_type !== 'All') {
      sql += ` AND r.room_type = ?`;
      params.push(room_type);
    }

    if (min_capacity && Number(min_capacity) > 0) {
      sql += ` AND r.capacity >= ?`;
      params.push(Number(min_capacity));
    }

    sql += ` ORDER BY r.price_per_night ASC`;

    if (limit && Number(limit) > 0) {
      sql += ` LIMIT ?`;
      params.push(Number(limit));
    }

    const availableRooms = await dbQuery.all(sql, params);

    res.json({
      success: true,
      query: { check_in, check_out, room_type: room_type || 'All', min_capacity: min_capacity || 1 },
      totalAvailable: availableRooms.length,
      rooms: availableRooms
    });
  } catch (error) {
    console.error('Error in room search/available:', error);
    res.status(500).json({ success: false, message: 'Server error searching available rooms', error: error.message });
  }
}

/**
 * GET /api/rooms/search
 * GET /api/rooms/available
 * Search rooms available for a specified date range [check_in, check_out]
 */
router.get('/search', handleRoomSearch);
router.get('/available', handleRoomSearch);

/**
 * GET /api/rooms
 * List all rooms with optional filtering (room_type, status, search keyword, limit)
 */
router.get('/', async (req, res) => {
  try {
    const { room_type, status, search, limit } = req.query;
    let sql = 'SELECT * FROM rooms WHERE 1=1';
    const params = [];

    const filterType = room_type || req.query.type;
    if (filterType && filterType !== 'All') {
      sql += ' AND room_type = ?';
      params.push(filterType);
    }

    const filterStatus = status || req.query.availability_status;
    if (filterStatus && filterStatus !== 'All') {
      sql += ' AND status = ?';
      params.push(filterStatus);
    }

    if (search && search.trim() !== '') {
      sql += ' AND (room_number LIKE ? OR room_type LIKE ? OR description LIKE ? OR amenities LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY room_number ASC';

    if (limit && Number(limit) > 0) {
      sql += ' LIMIT ?';
      params.push(Number(limit));
    }

    const rooms = await dbQuery.all(sql, params);

    res.json({
      success: true,
      count: rooms.length,
      rooms
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rooms', error: error.message });
  }
});

/**
 * GET /api/rooms/:id
 * Retrieve room details by ID along with active bookings
 */
router.get('/:id', async (req, res) => {
  try {
    const room = await dbQuery.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) {
      return res.status(404).json({ success: false, message: `Room with ID ${req.params.id} not found.` });
    }

    const bookings = await dbQuery.all(
      `SELECT * FROM bookings WHERE room_id = ? AND booking_status != 'CANCELLED' ORDER BY check_in_date ASC`,
      [req.params.id]
    );

    res.json({ success: true, room, activeBookings: bookings });
  } catch (error) {
    console.error('Error retrieving room:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve room', error: error.message });
  }
});

/**
 * POST /api/rooms
 * Add a new room record with validation
 */
router.post('/', async (req, res) => {
  try {
    const {
      room_number,
      room_type,
      price_per_night,
      capacity,
      amenities,
      description,
      status,
      image_url
    } = req.body;

    // Validation checks
    if (!room_number || !room_number.toString().trim()) {
      return res.status(400).json({ success: false, message: 'Room number is required.' });
    }
    if (!room_type || !room_type.trim()) {
      return res.status(400).json({ success: false, message: 'Room type is required.' });
    }
    if (!price_per_night || Number(price_per_night) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid price per night greater than 0 is required.' });
    }

    const cleanRoomNo = room_number.toString().trim().toUpperCase();

    // Check duplicate room number
    const existing = await dbQuery.get('SELECT id FROM rooms WHERE room_number = ?', [cleanRoomNo]);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Room number "${cleanRoomNo}" already exists in the system.`
      });
    }

    const roomCapacity = Number(capacity) > 0 ? Number(capacity) : 2;
    const rawStatus = status || req.body.availability_status;
    const roomStatus = ['Available', 'Occupied', 'Maintenance'].includes(rawStatus) ? rawStatus : 'Available';
    const roomDesc = description ? description.trim() : `Luxurious ${room_type} room suited for a premium stay.`;
    const roomAmenities = amenities ? amenities.trim() : 'Free Wi-Fi, Air Conditioning, Smart TV, Premium Bedding';
    const defaultImage = 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80';
    const finalImage = (image_url && image_url.trim()) ? image_url.trim() : defaultImage;

    const result = await dbQuery.run(
      `INSERT INTO rooms (room_number, room_type, price_per_night, capacity, amenities, description, status, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cleanRoomNo, room_type.trim(), Number(price_per_night), roomCapacity, roomAmenities, roomDesc, roomStatus, finalImage]
    );

    const newRoom = await dbQuery.get('SELECT * FROM rooms WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      message: `Room ${cleanRoomNo} added successfully.`,
      room: newRoom
    });
  } catch (error) {
    console.error('Error adding room:', error);
    res.status(500).json({ success: false, message: 'Failed to create room', error: error.message });
  }
});

/**
 * PUT /api/rooms/:id
 * Update an existing room record
 */
router.put('/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    const existing = await dbQuery.get('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const {
      room_number,
      room_type,
      price_per_night,
      capacity,
      amenities,
      description,
      status,
      image_url
    } = req.body;

    // Check if new room_number is taken by another room
    if (room_number && room_number.toString().trim().toUpperCase() !== existing.room_number) {
      const duplicate = await dbQuery.get('SELECT id FROM rooms WHERE room_number = ? AND id != ?', [
        room_number.toString().trim().toUpperCase(),
        roomId
      ]);
      if (duplicate) {
        return res.status(409).json({ success: false, message: `Room number ${room_number} is already taken.` });
      }
    }

    const updatedRoomNo = room_number ? room_number.toString().trim().toUpperCase() : existing.room_number;
    const updatedType = room_type ? room_type.trim() : existing.room_type;
    const updatedPrice = price_per_night ? Number(price_per_night) : existing.price_per_night;
    const updatedCap = capacity ? Number(capacity) : existing.capacity;
    const updatedAmenities = amenities !== undefined ? amenities : existing.amenities;
    const updatedDesc = description !== undefined ? description : existing.description;
    const rawStatus = status || req.body.availability_status;
    const updatedStatus = rawStatus ? rawStatus : existing.status;
    const updatedImage = image_url !== undefined ? image_url : existing.image_url;

    await dbQuery.run(
      `UPDATE rooms SET
        room_number = ?,
        room_type = ?,
        price_per_night = ?,
        capacity = ?,
        amenities = ?,
        description = ?,
        status = ?,
        image_url = ?
       WHERE id = ?`,
      [updatedRoomNo, updatedType, updatedPrice, updatedCap, updatedAmenities, updatedDesc, updatedStatus, updatedImage, roomId]
    );

    const updated = await dbQuery.get('SELECT * FROM rooms WHERE id = ?', [roomId]);
    res.json({
      success: true,
      message: 'Room updated successfully.',
      room: updated
    });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ success: false, message: 'Failed to update room', error: error.message });
  }
});

/**
 * DELETE /api/rooms/:id
 * Delete a room record
 */
router.delete('/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    const room = await dbQuery.get('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (!room) {
      return res.status(404).json({ success: false, message: `Room with ID ${roomId} does not exist.` });
    }

    // Check for active (non-cancelled) bookings
    const activeBookings = await dbQuery.all(
      `SELECT id FROM bookings WHERE room_id = ? AND booking_status = 'CONFIRMED'`,
      [roomId]
    );

    if (activeBookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete room ${room.room_number} because it has ${activeBookings.length} active confirmed booking(s). Please cancel those bookings first.`
      });
    }

    await dbQuery.run('DELETE FROM rooms WHERE id = ?', [roomId]);

    res.json({
      success: true,
      message: `Room ${room.room_number} successfully deleted.`
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ success: false, message: 'Failed to delete room', error: error.message });
  }
});

module.exports = router;
