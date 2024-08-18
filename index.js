const { chromium } = require('@playwright/test');
const tmp = require('tmp');
const fs = require('fs');

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const { html } = JSON.parse(event.body);

    if (typeof html !== 'string' || html.trim().length === 0) {
        console.error('Invalid HTML content provided');
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid HTML content provided' }),
        };
    }

    let browser;
    let tempFile;
    try {
        console.log('Launching Playwright browser...');
        browser = await chromium.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            headless: true,
        });
        console.log('Playwright browser launched.');

        const page = await browser.newPage();
        console.log('New page created.');

        await page.setContent(html, { waitUntil: 'networkidle' });
        console.log('Page content set.');

        tempFile = tmp.fileSync({ postfix: '.pdf' });
        const filePath = tempFile.name;
        console.log('Temporary file created:', filePath);

        await page.pdf({
            path: filePath,
            format: 'A4',
            printBackground: true,
        });
        console.log('PDF generated.');

        const fileBuffer = fs.readFileSync(filePath);
        const base64Pdf = fileBuffer.toString('base64');

        return {
            statusCode: 200,
            body: JSON.stringify({ pdf: base64Pdf }),
        };
    } catch (error) {
        console.error('Error during PDF generation:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate PDF' }),
        };
    } finally {
        if (browser) {
            console.log('Closing Playwright browser...');
            await browser.close();
        }
        if (tempFile) {
            console.log('Removing temporary file...');
            tempFile.removeCallback();
        }
    }
};
