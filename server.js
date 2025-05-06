const express = require('express');
const db = require('./models'); // Import Sequelize setup

const app = express();
const port = 3001;

app.get('/', (req, res) => {
  res.send('Hello World! DB connection test endpoint: /test-db');
});

// Endpoint to test database connection
app.get('/test-db', async (req, res) => {
  try {
    await db.sequelize.authenticate();
    res.send('Database connection successful!');
    
    // Optional: Test fetching data if the table exists and has data
    /*
    const members = await db.Member.findAll({ limit: 5 });
    if (members.length > 0) {
        console.log("Fetched members:", members.map(m => m.toJSON()));
        res.send(`Database connection successful! Fetched ${members.length} members.`);
    } else {
        res.send('Database connection successful! No members found in member_t table.');
    }
    */

  } catch (error) {
    console.error('Unable to connect to the database:', error);
    res.status(500).send('Database connection failed: ' + error.message);
  }
});

app.listen(port, async () => {
  console.log(`Express server listening on port ${port}`);
  
  // Test DB connection on startup
  try {
    await db.sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Sync models with the database.
    // Use { force: true } drops and recreates tables (USE WITH CAUTION!).
    await db.sequelize.sync({ force: false });
    console.log("Database synchronized based on defined models.");

  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}); 