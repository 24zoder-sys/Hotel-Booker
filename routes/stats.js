const express = require('express');
const router = express.Router();
const { dbQuery } = require('../database/db');

/**
 * GET /api/stats
 * Dashboard overview statistics
 */
router.get('/', async (req, res) => {
  try {
    const totalRooms = await dbQuery.get('SELECT COUNT(*) as count FROM rooms');
    const maintenanceRooms = await dbQuery.get("SELECT COUNT(*) as count FROM rooms WHERE status = 'Maintenance'");
    const totalBookings = await dbQuery.get('SELECT COUNT(*) as count FROM bookings');
    const activeBookings = await dbQuery.get("SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'CONFIRMED'");
    const cancelledBookings = await dbQuery.get("SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'CANCELLED'");
    const revenueRow = await dbQuery.get("SELECT SUM(total_price) as sum FROM bookings WHERE booking_status = 'CONFIRMED'");

    const todayStr = new Date().toISOString().split('T')[0];
    // Currently occupied rooms today
    const currentlyOccupied = await dbQuery.get(
      `SELECT COUNT(DISTINCT room_id) as count FROM bookings
       WHERE booking_status = 'CONFIRMED'
         AND check_in_date <= ?
         AND check_out_date > ?`,
      [todayStr, todayStr]
    );

    const roomTypes = await dbQuery.all(`
      SELECT room_type, COUNT(*) as count, AVG(price_per_night) as avg_price
      FROM rooms
      GROUP BY room_type
    `);

    const payload = {
      totalRooms: totalRooms.count || 0,
      total_rooms: totalRooms.count || 0,
      currentlyOccupied: currentlyOccupied.count || 0,
      currently_occupied: currentlyOccupied.count || 0,
      availableNow: Math.max(0, (totalRooms.count || 0) - (currentlyOccupied.count || 0) - (maintenanceRooms.count || 0)),
      available_rooms: Math.max(0, (totalRooms.count || 0) - (currentlyOccupied.count || 0) - (maintenanceRooms.count || 0)),
      maintenanceRooms: maintenanceRooms.count || 0,
      totalBookings: totalBookings.count || 0,
      total_bookings: totalBookings.count || 0,
      activeBookings: activeBookings.count || 0,
      confirmed_bookings: activeBookings.count || 0,
      cancelledBookings: cancelledBookings.count || 0,
      cancelled_bookings: cancelledBookings.count || 0,
      totalRevenue: revenueRow.sum ? Number(revenueRow.sum.toFixed(2)) : 0,
      total_revenue: revenueRow.sum ? Number(revenueRow.sum.toFixed(2)) : 0,
      roomTypes,
      room_types: roomTypes
    };

    res.json({
      success: true,
      stats: payload,
      ...payload
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve stats', error: error.message });
  }
});

module.exports = router;
