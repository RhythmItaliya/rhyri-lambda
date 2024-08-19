const puppeteer = require('puppeteer');

// Function to handle requests
exports.handler = async (event) => {
  try {
    const { html } = JSON.parse(event.body);

    if (typeof html !== 'string' || html.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid HTML content provided" }),
      };
    }

    // Check if running locally or in Lambda environment
    const isLambda = process.env.AWS_EXECUTION_ARN !== undefined;

    // Launch the browser
    const browser = await puppeteer.launch({
      args: isLambda ? [] : ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1200, height: 800 },
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: pdfBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('Error during PDF generation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to generate PDF' }),
    };
  }
};
