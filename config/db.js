const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Remove the old options - Mongoose 6+ handles them automatically
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        return conn;
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        console.log('💡 Please check:');
        console.log('1. MongoDB is running (mongod)');
        console.log('2. MONGODB_URI in .env is correct');
        console.log('3. Network connection is available');
        process.exit(1);
    }
};

// Connection events
mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ Mongoose disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('🔌 Mongoose connection closed');
    process.exit(0);
});

module.exports = connectDB;