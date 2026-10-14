const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'hotel.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Enable foreign key constraints
db.run('PRAGMA foreign_keys = ON');

// Initialize database schema
db.serialize(() => {
  // Rooms table
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT UNIQUE NOT NULL,
      room_type TEXT NOT NULL,
      price_per_night REAL NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 2,
      amenities TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'Available',
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bookings table
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_ref TEXT UNIQUE NOT NULL,
      room_id INTEGER NOT NULL,
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      guest_phone TEXT,
      check_in_date TEXT NOT NULL,
      check_out_date TEXT NOT NULL,
      total_nights INTEGER NOT NULL,
      total_price REAL NOT NULL,
      booking_status TEXT NOT NULL DEFAULT 'CONFIRMED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `);

  // Seed sample rooms if rooms table is empty
  db.get('SELECT COUNT(*) as count FROM rooms', (err, row) => {
    if (err) {
      console.error('Error checking room count:', err);
      return;
    }

    if (row && row.count === 0) {
      console.log('Seeding initial luxury rooms data...');
      const sampleRooms = [
        {
          room_number: '101',
          room_type: 'Deluxe',
          price_per_night: 120.0,
          capacity: 2,
          amenities: 'High-speed Wi-Fi, King Bed, Smart TV, City View, Rainforest Shower',
          description: 'Contemporary deluxe room featuring premium hardwood flooring, luxury linens, and stunning skyline views.',
          status: 'Available',
          image_url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80'
        },
        {
          room_number: '102',
          room_type: 'Single',
          price_per_night: 75.0,
          capacity: 1,
          amenities: 'Fast Wi-Fi, Queen Bed, Workstation, Mini Bar, Coffee Maker',
          description: 'Designed for solo travelers and business professionals needing comfort, focus, and modern hospitality.',
          status: 'Available',
          image_url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
        },
        {
          room_number: '201',
          room_type: 'Suite',
          price_per_night: 220.0,
          capacity: 3,
          amenities: 'Private Balcony, Jacuzzi, Living Room, King Bed, Ocean View, Breakfast Included',
          description: 'Spacious multi-room luxury suite with an exquisite private balcony overlooking panoramic sunsets.',
          status: 'Available',
          image_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
        },
        {
          room_number: '202',
          room_type: 'Double',
          price_per_night: 140.0,
          capacity: 2,
          amenities: 'Twin Beds, High-speed Wi-Fi, Garden View, 24/7 Room Service, Safe',
          description: 'Bright and airy double room tailored for friends or couples exploring the city in style.',
          status: 'Available',
          image_url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80'
        },
        {
          room_number: '301',
          room_type: 'Family Suite',
          price_per_night: 290.0,
          capacity: 4,
          amenities: '2 King Beds, Dining Area, Kids Play Area, Kitchenette, Smart Entertainment',
          description: 'Expansive family retreat offering abundant space, kid-friendly amenities, and homelike warmth.',
          status: 'Available',
          image_url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80'
        },
        {
          room_number: '401',
          room_type: 'Presidential Suite',
          price_per_night: 550.0,
          capacity: 4,
          amenities: 'Private Butler, Rooftop Terrace, Private Pool, Master Spa, Champagne Bar',
          description: 'The pinnacle of luxury with 360-degree skyline views, bespoke concierge service, and world-class design.',
          status: 'Available',
          image_url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80'
        }
      ];

      const stmt = db.prepare(`
        INSERT INTO rooms (room_number, room_type, price_per_night, capacity, amenities, description, status, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      sampleRooms.forEach((r) => {
        stmt.run([r.room_number, r.room_type, r.price_per_night, r.capacity, r.amenities, r.description, r.status, r.image_url]);
      });
      stmt.finalize();
      console.log('Sample rooms seeded successfully.');
    }
  });
});

// Helper wrapper for async/await promise queries
const dbQuery = {
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
};

module.exports = { db, dbQuery };
