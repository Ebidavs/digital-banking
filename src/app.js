require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./Config/db');
const authRoutes = require('./routes/authRoutes');
const identityRoutes = require('./routes/identityRoutes');
const accountRoutes = require('./routes/accountRoutes');
const bankingRoutes = require('./routes/bankingRoutes');
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/banking', bankingRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Banking API is running' });
});

async function startServer() {
  try {
    await connectDB();

    const port = process.env.PORT || 8000;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();