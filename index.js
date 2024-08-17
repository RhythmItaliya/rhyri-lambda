const puppeteer = require('puppeteer-core');
const fs = require('fs');
const tmp = require('tmp');

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
        const executablePath = '/chromium/chrome-linux/chrome-linux/chrome';

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
