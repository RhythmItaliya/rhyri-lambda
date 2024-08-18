const fs = require('fs');
const { execSync } = require('child_process');
const { LambdaClient, UpdateFunctionCodeCommand } = require('@aws-sdk/client-lambda');

const functionName = 'pdf-generator';
const region = 'ap-south-1';
const zipFilePath = 'function.zip';

const lambdaClient = new LambdaClient({ region });

const zipCommand = `zip -r ${zipFilePath} . -x '*.git*' -x '*.log' -x '.lambdaignore'`;

const createZip = () => {
  console.log('Creating ZIP file...');
  try {
    execSync(zipCommand, { stdio: 'inherit' });
    console.log('ZIP file created successfully.');
  } catch (error) {
    console.error('Error creating ZIP file:', error);
    process.exit(1);
  }
};

const updateLambdaFunction = async () => {
  try {
    const zipFileBuffer = fs.readFileSync(zipFilePath);
    const command = new UpdateFunctionCodeCommand({
      FunctionName: functionName,
      ZipFile: zipFileBuffer,
      Publish: true,
    });

    console.log('Updating Lambda function...');
    const response = await lambdaClient.send(command);
    console.log('Lambda function updated successfully:', response);
  } catch (error) {
    console.error('Error updating Lambda function:', error);
    process.exit(1);
  }
};

const deploy = async () => {
  createZip();
  await updateLambdaFunction();
};

deploy();
