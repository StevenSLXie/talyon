import os
import json
import csv
import logging
from datetime import datetime, timedelta
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class LLMJobParser:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self.scraped_date = datetime.now()
        
    def parse_raw_texts(self, input_file_path: str):
        """
        Parse raw job texts using GPT-4o-mini with BATCH PROCESSING
        Groups jobs into batches to minimize API calls
        """
        logger.info(f"Starting to parse raw texts from: {input_file_path}")
        
        # Read raw texts
        raw_texts = self.read_raw_texts(input_file_path)
        logger.info(f"Found {len(raw_texts)} raw job texts to parse")
        
        # Group jobs into batches for efficient processing
        batches = self.create_batches(raw_texts)
        logger.info(f"Created {len(batches)} batches for processing")
        
        # Parse each batch using LLM
        all_parsed_jobs = []
        for i, batch in enumerate(batches):
            logger.info(f"Processing batch {i+1}/{len(batches)} ({len(batch)} jobs)")
            try:
                batch_results = self.parse_batch(batch)
                if batch_results:
                    all_parsed_jobs.extend(batch_results)
            except Exception as e:
                logger.error(f"Error processing batch {i+1}: {str(e)}")
                continue
        
        logger.info(f"Successfully parsed {len(all_parsed_jobs)} jobs from {len(batches)} batches")
        
        # Deduplicate based on company + title + salary range
        deduplicated_jobs = self.deduplicate_jobs(all_parsed_jobs)
        logger.info(f"After deduplication: {len(deduplicated_jobs)} unique jobs (removed {len(all_parsed_jobs) - len(deduplicated_jobs)} duplicates)")
        
        # Save results
        self.save_results(deduplicated_jobs)
        
        return deduplicated_jobs
    
    def read_raw_texts(self, file_path: str):
        """Read and split raw texts from the input file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Split by job separators
        jobs = content.split('=== JOB ')
        jobs = [job.strip() for job in jobs if job.strip()]
        
        # Extract just the text content (remove the job number and separators)
        raw_texts = []
        for job in jobs:
            # Skip empty jobs
            if not job:
                continue
                
            # Split by lines and process
            lines = job.split('\n')
            text_lines = []
            
            # Skip the first line if it's just a number (job number)
            start_idx = 1 if lines[0].strip().isdigit() else 0
            
            for line in lines[start_idx:]:
                # Stop at the separator line
                if line.strip().startswith('='):
                    break
                text_lines.append(line)
            
            # Join the text lines and clean up
            text_content = '\n'.join(text_lines).strip()
            if text_content:
                raw_texts.append(text_content)
        
        return raw_texts
    
    def deduplicate_jobs(self, jobs: list):
        """Deduplicate jobs based on company + title + salary range"""
        seen_jobs = set()
        unique_jobs = []
        
        for job in jobs:
            # Create deduplication key from company + title + salary range
            company = job.get('company', '').strip().lower()
            title = job.get('title', '').strip().lower()
            salary_low = job.get('salary_low', '').strip()
            salary_high = job.get('salary_high', '').strip()
            
            # Create a unique key
            dedup_key = f"{company}|{title}|{salary_low}|{salary_high}"
            
            if dedup_key not in seen_jobs:
                seen_jobs.add(dedup_key)
                unique_jobs.append(job)
            else:
                logger.debug(f"Duplicate job found: {company} - {title} ({salary_low}-{salary_high})")
        
        return unique_jobs
    
    def create_batches(self, raw_texts: list):
        """
        Create batches of jobs for efficient processing
        Each batch should be under 100k characters to avoid token limits
        """
        batches = []
        current_batch = []
        current_batch_size = 0
        max_batch_size = 20000  # 20k characters per batch (very conservative to avoid truncation)
        
        for raw_text in raw_texts:
            text_size = len(raw_text)
            
            # If adding this job would exceed batch size, start a new batch
            if current_batch_size + text_size > max_batch_size and current_batch:
                batches.append(current_batch)
                current_batch = [raw_text]
                current_batch_size = text_size
            else:
                current_batch.append(raw_text)
                current_batch_size += text_size
        
        # Add the last batch if it has content
        if current_batch:
            batches.append(current_batch)
        
        return batches
    
    def parse_batch(self, batch: list):
        """
        Parse a batch of jobs in a single LLM call
        """
        # Combine all jobs in the batch into a single text
        batch_text = "\n\n=== BATCH SEPARATOR ===\n\n".join(batch)
        
            prompt = f"""
You are a job data extraction expert. Parse the following batch of raw job texts and extract the required information for EACH job.

For EACH job, extract the following fields and return a JSON array with one object per job:
- company: Company name
- title: Job title (remove internal references like "(Ref 26099)", "(#78196)", etc.)
- location: Job location (North/South/East/West/Central/Singapore/Islandwide)
- industry: Industry or job category
- post_date: Convert relative dates to concrete date. If it says "Posted today", use today's date. If it says "Posted yesterday", use yesterday's date. If it says "Posted X days ago", calculate the date. Format as YYYY-MM-DD.
- salary_low: Lower bound of salary range (e.g., "6000" from "$6,000to$8,000" or "N/A" if not specified)
- salary_high: Upper bound of salary range (e.g., "8000" from "$6,000to$8,000" or "N/A" if not specified)
- job_type: Job type (Full Time/Part Time/Contract/Temporary/Internship/Permanent)
- url: Job URL if present (look for "JOB_URL:" prefix in the text)
- application_count: Number of applications received (extract number from text like "0 application" or "5 applications")
- raw_text: The original raw text for this specific job

Important notes:
1. For post_date: Today is {self.scraped_date.strftime('%Y-%m-%d')}
2. If any field is not found, use "N/A"
3. Return ONLY a valid JSON array starting with [ and ending with ], no other text
4. Each job should be a separate object in the array
5. Make sure to extract the correct raw_text for each individual job (not the entire batch)

Example format:
[
  {{
    "company": "Company Name",
    "title": "Job Title",
    "location": "Singapore",
    "industry": "Technology",
    "post_date": "2025-09-17",
    "salary_low": "6000",
    "salary_high": "8000",
    "job_type": "Full Time",
    "url": "https://example.com",
    "application_count": "0",
    "raw_text": "Original job text here"
  }}
]

The batch contains multiple jobs separated by "=== BATCH SEPARATOR ===". Extract information for each job separately.

Batch of job texts:
{batch_text}
"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant designed to output JSON arrays."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1
            )
            
            # Parse the response
            response_content = response.choices[0].message.content
            logger.info(f"LLM response length: {len(response_content)}")
            logger.info(f"LLM response preview: {response_content[:200]}...")
            
            if not response_content.strip():
                logger.error("Empty response from LLM")
                return []
            
            # Check if response appears truncated (doesn't end with ])
            if not response_content.strip().endswith(']'):
                logger.warning("Response appears truncated (doesn't end with ])")
                logger.warning(f"Response ends with: ...{response_content[-100:]}")
                # Try to fix truncated JSON by adding closing bracket
                if response_content.strip().startswith('[') and not response_content.strip().endswith(']'):
                    response_content = response_content.strip() + ']'
                    logger.info("Attempted to fix truncated JSON by adding closing bracket")
            
            try:
                result = json.loads(response_content)
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing error: {str(e)}")
                logger.error(f"Raw response: {response_content}")
                return []
            
            # Handle both single object and array responses
            if isinstance(result, dict):
                # If it's a single object, wrap it in an array
                parsed_jobs = [result]
            elif isinstance(result, list):
                parsed_jobs = result
            else:
                logger.error("Unexpected response format from LLM")
                return []
            
            # Add scraped_at timestamp to each job
            for job in parsed_jobs:
                job['scraped_at'] = self.scraped_date.isoformat()
            
            logger.info(f"Successfully parsed {len(parsed_jobs)} jobs from batch")
            return parsed_jobs
            
        except Exception as e:
            logger.error(f"Error in batch LLM parsing: {str(e)}")
            return []
    
    def parse_single_job(self, raw_text: str):
        """Parse a single job's raw text using GPT-4o-mini"""
        
        prompt = f"""
You are a job data extraction expert. Parse the following raw job text and extract the required information.

Raw job text:
{raw_text}

Extract the following fields and return ONLY a valid JSON object:
- company: Company name
- title: Job title
- location: Job location (North/South/East/West/Central/Singapore/Islandwide)
- industry: Industry or job category
- post_date: Convert relative dates to concrete date. If it says "Posted today", use today's date. If it says "Posted yesterday", use yesterday's date. If it says "Posted X days ago", calculate the date. Format as YYYY-MM-DD.
- salary_range: Salary range (e.g., "$6,000to$8,000" or "N/A" if not specified)
- job_type: Job type (Full Time/Part Time/Contract/Temporary/Internship/Permanent)
- url: Job URL if present (look for "JOB_URL:" prefix in the text)
- application_count: Number of applications received (extract number from text like "0 application" or "5 applications")
- raw_text: The original raw text

Important notes:
1. For post_date: Today is {self.scraped_date.strftime('%Y-%m-%d')}
2. If any field is not found, use "N/A"
3. Return ONLY the JSON object, no other text
4. Ensure the JSON is valid and properly formatted

JSON:
"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a job data extraction expert. Extract job information and return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            # Extract JSON from response
            json_text = response.choices[0].message.content.strip()
            
            # Clean up the response (remove any markdown formatting)
            if json_text.startswith('```json'):
                json_text = json_text[7:]
            if json_text.endswith('```'):
                json_text = json_text[:-3]
            
            # Parse JSON
            job_data = json.loads(json_text)
            
            # Add scraped_at timestamp
            job_data['scraped_at'] = self.scraped_date.isoformat()
            
            return job_data
            
        except Exception as e:
            logger.error(f"Error in LLM parsing: {str(e)}")
            return None
    
    def parse_long_job(self, raw_text: str):
        """
        Parse a long job text by chunking it into smaller pieces
        """
        # Split the text into chunks of ~100k characters
        chunk_size = 100000
        chunks = []
        
        # Try to split at job separators first
        if '=== JOB ' in raw_text:
            # Split by job separators
            job_parts = raw_text.split('=== JOB ')
            current_chunk = ""
            
            for part in job_parts:
                if len(current_chunk + part) < chunk_size:
                    current_chunk += ("=== JOB " + part if current_chunk else part)
                else:
                    if current_chunk:
                        chunks.append(current_chunk)
                    current_chunk = "=== JOB " + part
            
            if current_chunk:
                chunks.append(current_chunk)
        else:
            # Fallback: split by character count
            for i in range(0, len(raw_text), chunk_size):
                chunks.append(raw_text[i:i + chunk_size])
        
        logger.info(f"Split long text into {len(chunks)} chunks")
        
        # Parse each chunk
        chunk_results = []
        for i, chunk in enumerate(chunks):
            logger.info(f"Parsing chunk {i+1}/{len(chunks)}")
            try:
                parsed_chunk = self.parse_single_job(chunk)
                if parsed_chunk:
                    chunk_results.append(parsed_chunk)
            except Exception as e:
                logger.error(f"Error parsing chunk {i+1}: {str(e)}")
                continue
        
        # Merge results from all chunks
        if chunk_results:
            # Use the first chunk as base and merge others
            merged_job = chunk_results[0]
            
            # Merge additional fields from other chunks
            for chunk_result in chunk_results[1:]:
                # Add any missing fields
                for key, value in chunk_result.items():
                    if key not in merged_job or merged_job[key] == "N/A":
                        merged_job[key] = value
            
            # Combine raw_text from all chunks
            merged_job['raw_text'] = raw_text
            
            return merged_job
        
        return None
    
    def save_results(self, parsed_jobs):
        """Save parsed jobs to JSON and CSV files in the output folder"""
        if not parsed_jobs:
            logger.warning("No jobs to save.")
            return
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save to JSON
        json_filename = f"output/parsed_jobs_{timestamp}.json"
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(parsed_jobs, f, ensure_ascii=False, indent=2)
        logger.info(f"JSON saved to: {json_filename}")
        
        # Save to CSV
        csv_filename = f"output/parsed_jobs_{timestamp}.csv"
        with open(csv_filename, 'w', newline='', encoding='utf-8') as f:
            if parsed_jobs:
                writer = csv.DictWriter(f, fieldnames=parsed_jobs[0].keys())
                writer.writeheader()
                writer.writerows(parsed_jobs)
        logger.info(f"CSV saved to: {csv_filename}")
        
        logger.info(f"Total jobs saved: {len(parsed_jobs)}")

def main():
    """Main function to run the LLM parser"""
    parser = LLMJobParser()
    
    # Find the most recent raw text file in input folder
    input_files = [f for f in os.listdir('input') if f.startswith('raw_job_texts_') and f.endswith('.txt')]
    if not input_files:
        logger.error("No raw text files found in input folder")
        return
    
    # Get the most recent file
    latest_file = sorted(input_files)[-1]
    input_file_path = f"input/{latest_file}"
    
    logger.info(f"Using input file: {input_file_path}")
    
    try:
        parsed_jobs = parser.parse_raw_texts(input_file_path)
        logger.info(f"Parsing completed successfully! Processed {len(parsed_jobs)} jobs.")
    except Exception as e:
        logger.error(f"Parsing failed: {str(e)}")

if __name__ == "__main__":
    main()
