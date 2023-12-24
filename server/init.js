const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('your_database_name.db');

const fData = {
  
}

// Create the players table
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY, name TEXT, playing INTEGER)');

  // Create the units table
  db.run('CREATE TABLE IF NOT EXISTS units (id INTEGER PRIMARY KEY, player_id INTEGER, uid INTEGER, a INTEGER, b INTEGER, s INTEGER)');

});

// Close the database connection
db.close();
