const fs = require('fs');
const path = require('path');

// Read the refined jobs JSON file
const jobsFilePath = path.join(__dirname, '..', '..', 'output', 'refined_jobs_20250918_222615.json');

console.log('Looking for jobs file at:', jobsFilePath);

if (!fs.existsSync(jobsFilePath)) {
  console.error('Jobs file not found at:', jobsFilePath);
  process.exit(1);
}

try {
  const fileContent = fs.readFileSync(jobsFilePath, 'utf8');
  const jobsData = JSON.parse(fileContent);
  
  console.log('Jobs data loaded successfully!');
  console.log('Total jobs:', jobsData.jobs ? jobsData.jobs.length : jobsData.length);
  
  // Show sample job structure
  const sampleJob = jobsData.jobs ? jobsData.jobs[0] : jobsData[0];
  console.log('Sample job structure:', JSON.stringify(sampleJob, null, 2));
  
} catch (error) {
  console.error('Error reading jobs file:', error);
  process.exit(1);
}

