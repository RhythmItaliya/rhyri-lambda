const puppeteer = require('puppeteer-core');
const fs = require('fs');
const tmp = require('tmp');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const unzipper = require('unzipper');
const path = require('path');

exports.handler = async (event) => {
    const { html } = JSON.parse(event.body);

    if (typeof html !== 'string' || html.trim().length === 0) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid HTML content provided' }),
        };
    }

    let browser;
    let tempFile;
    try {
        // S3 bucket and key for chromium.zip
        const bucketName = 'chromium-binary-db';
        const key = 'chromium.zip';
        
        // Download and extract Chromium binary
        const zipPath = '/tmp/chromium.zip';
        const chromiumDir = '/tmp/chromium';
        
        const s3Params = { Bucket: bucketName, Key: key };
        const file = fs.createWriteStream(zipPath);
        
        await new Promise((resolve, reject) => {
            s3.getObject(s3Params).createReadStream()
                .pipe(file)
                .on('finish', resolve)
                .on('error', reject);
        });
        
        await new Promise((resolve, reject) => {
            fs.createReadStream(zipPath)
                .pipe(unzipper.Extract({ path: chromiumDir }))
                .on('finish', resolve)
                .on('error', reject);
        });
        
        // Path to Chromium binary after extraction
        const executablePath = path.join(chromiumDir, 'chrome');

        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            executablePath,
            headless: true,
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        tempFile = tmp.fileSync({ postfix: '.pdf' });
        const filePath = tempFile.name;

        await page.pdf({
            path: filePath,
            format: 'A4',
            printBackground: true,
        });

        const fileBuffer = fs.readFileSync(filePath);
        const base64Pdf = fileBuffer.toString('base64');

        return {
            statusCode: 200,
            body: JSON.stringify({ pdf: base64Pdf }),
        };
    } catch (error) {
        console.error('Error during PDF generation:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate PDF' }),
        };
    } finally {
        if (browser) {
            await browser.close();
        }
        if (tempFile) {
            tempFile.removeCallback();
        }
    }
};
