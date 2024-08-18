const puppeteer = require('puppeteer-core');
const fs = require('fs');
const tmp = require('tmp');
const AWS = require('aws-sdk');
const unzipper = require('unzipper');
const path = require('path');

const s3 = new AWS.S3();

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
        // Create a temporary directory
        const tempDir = tmp.dirSync();
        const executablePath = path.join(tempDir.name, 'chrome');

        // Download Chromium from S3
        const s3Params = {
            Bucket: 'chromium-binary-db',
            Key: 'chromium.zip',
        };

        const s3Object = await s3.getObject(s3Params).promise();
        const zipPath = path.join(tempDir.name, 'chromium.zip');
        fs.writeFileSync(zipPath, s3Object.Body);

        // Extract Chromium binary
        await fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: tempDir.name }))
            .promise();

        // Adjust the executablePath according to the extracted structure
        const extractedChromiumPath = path.join(tempDir.name, 'chrome-linux', 'chrome'); 

        // Launch Puppeteer
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            executablePath: extractedChromiumPath,
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
