const mongoose = require('mongoose');
const { mongoUri } = require('./env');

mongoose.set('strictQuery', true);

async function connectDB(uri = mongoUri) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  await mongoose.connect(uri);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB, mongoose };
