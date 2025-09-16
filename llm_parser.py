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
        Parse raw job texts using GPT-4o-mini and convert to structured data
        """
        logger.info(f"Starting to parse raw texts from: {input_file_path}")
        
        # Read raw texts
        raw_texts = self.read_raw_texts(input_file_path)
        logger.info(f"Found {len(raw_texts)} raw job texts to parse")
        
        # Parse each text using LLM
        parsed_jobs = []
        for i, raw_text in enumerate(raw_texts):
            logger.info(f"Parsing job {i+1}/{len(raw_texts)}")
            try:
                parsed_job = self.parse_single_job(raw_text)
                if parsed_job:
                    parsed_jobs.append(parsed_job)
            except Exception as e:
                logger.error(f"Error parsing job {i+1}: {str(e)}")
                continue
        
        logger.info(f"Successfully parsed {len(parsed_jobs)} jobs")
        
        # Save results
        self.save_results(parsed_jobs)
        
        return parsed_jobs
    
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
            if job.startswith('==='):
                continue
            # Remove the job number and separators
            lines = job.split('\n')
            text_lines = []
            for line in lines:
                if line.startswith('===') or line.startswith('JOB '):
                    continue
                text_lines.append(line)
            
            text_content = '\n'.join(text_lines).strip()
            if text_content:
                raw_texts.append(text_content)
        
        return raw_texts
    
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
