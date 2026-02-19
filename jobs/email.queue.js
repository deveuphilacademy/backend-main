const Queue = require('bull');
const { secret } = require('../config/secret');
const { sendEmailStandalone } = require('../config/email');

// Initialize the email queue
const emailQueue = new Queue('email-notifications', secret.redis_url, {
    redis: {
        // Bull handles connection logic, but these can be expanded if needed
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: true,
    }
});

// Worker: Process jobs from the queue
emailQueue.process(async (job) => {
    const { to, subject, html } = job.data;

    console.log(`Processing email job: ${job.id} to ${to}`);

    try {
        const result = await sendEmailStandalone({
            from: secret.email_user,
            to,
            subject,
            html
        });
        console.log(`Email job ${job.id} completed successfully`);
        return result;
    } catch (error) {
        console.error(`Email job ${job.id} failed:`, error.message);
        throw error; // Let Bull handle the retry based on job options
    }
});

module.exports = emailQueue;
