const cron = require('node-cron');
const notificationService = require('../services/notification.service');

/**
 * Daily Stock Alert Job
 * Runs every day at 8:00 AM to check for low stock products
 * and notify admins via in-app and email.
 */
const stockAlertJob = cron.schedule('0 8 * * *', async () => {
    console.log('Running daily stock alert job [8:00 AM]...');
    try {
        await notificationService.checkAndNotifyLowStock();
        console.log('Daily stock alert job completed successfully.');
    } catch (error) {
        console.error('Daily stock alert job failed:', error);
    }
});

module.exports = stockAlertJob;
