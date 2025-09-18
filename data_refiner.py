#!/usr/bin/env python3
"""
Data Refiner for scraped job data
Fixes data quality issues and extracts missing fields from raw_text
"""

import json
import re
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
from collections import defaultdict

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DataRefiner:
    def __init__(self):
        self.refined_jobs = []
        
    def refine_jobs(self, input_json_file: str) -> str:
        """
        Refine job data from input JSON file
        
        Args:
            input_json_file: Path to input JSON file
            
        Returns:
            Path to refined JSON file
        """
        logger.info(f"Loading data from: {input_json_file}")
        
        with open(input_json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        jobs = data.get('jobs', [])
        logger.info(f"Processing {len(jobs)} jobs")
        
        refined_jobs = []
        for i, job in enumerate(jobs):
            try:
                refined_job = self.refine_single_job(job)
                if refined_job:  # Only add if refinement succeeded
                    refined_jobs.append(refined_job)
                    
                if (i + 1) % 1000 == 0:
                    logger.info(f"Processed {i + 1}/{len(jobs)} jobs")
                    
            except Exception as e:
                logger.warning(f"Error refining job {i}: {e}")
                continue
        
        logger.info(f"Refined {len(refined_jobs)} jobs from {len(jobs)} original jobs")
        
        # Remove duplicates and fix dates
        logger.info("Removing duplicates and fixing post dates...")
        deduplicated_jobs = self.remove_duplicates_and_fix_dates(refined_jobs)
        
        logger.info(f"After deduplication: {len(deduplicated_jobs)} jobs")
        
        # Create refined output
        refined_data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "total_jobs": len(deduplicated_jobs),
                "description": "Refined job data from MyCareersFuture.sg with improved data quality, duplicates removed, and absolute dates",
                "original_file": input_json_file,
                "refinement_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "original_jobs": len(jobs),
                "jobs_after_refinement": len(refined_jobs),
                "jobs_after_deduplication": len(deduplicated_jobs)
            },
            "jobs": deduplicated_jobs
        }
        
        # Save refined data
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"output/refined_jobs_{timestamp}.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(refined_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Refined data saved to: {output_file}")
        return output_file
    
    def refine_single_job(self, job: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Refine a single job record
        
        Args:
            job: Original job record
            
        Returns:
            Refined job record or None if should be excluded
        """
        raw_text = job.get('raw_text', '')
        
        # Skip jobs with empty raw text
        if not raw_text or raw_text.strip() == '':
            return None
        
        # Extract data from raw text
        extracted_data = self.extract_data_from_raw_text(raw_text)
        
        # Skip if company is unknown or invalid
        company = extracted_data.get('company')
        if not company or company.lower() in ['unknown', 'recommended based on your skills & job applications']:
            return None
        
        # Create refined job record
        refined_job = {
            'company': company,
            'title': extracted_data.get('title', job.get('title', 'Unknown')),
            'location': extracted_data.get('location', 'Unknown'),
            'salary_low': extracted_data.get('salary_low', 0),
            'salary_high': extracted_data.get('salary_high', 0),
            'url': job.get('url', 'Unknown'),
            'industry': extracted_data.get('industry', job.get('industry', 'Unknown')),
            'job_type': extracted_data.get('job_type', 'Unknown'),
            'experience_level': extracted_data.get('experience_level', 'Unknown'),
            'post_date': extracted_data.get('post_date', job.get('post_date', 'Unknown')),
            'scraped_at': job.get('scraped_at', datetime.now().isoformat()),
            'raw_text': raw_text
        }
        
        # Always try to extract salary from raw text first
        salary_range = self.extract_salary_range_from_text(raw_text)
        if salary_range:
            refined_job['salary_low'] = salary_range[0]
            refined_job['salary_high'] = salary_range[1]
        else:
            # Debug: log when salary extraction fails
            logger.debug(f"Failed to extract salary from: {raw_text[:100]}...")
        
        # Skip if no proper salary range
        if refined_job['salary_low'] == 0 or refined_job['salary_high'] == 0:
            return None
        
        # Generate job hash
        refined_job['job_hash'] = self.generate_job_hash(
            refined_job['company'],
            refined_job['title'],
            refined_job['salary_low'],
            refined_job['salary_high']
        )
        
        return refined_job
    
    def extract_data_from_raw_text(self, raw_text: str) -> Dict[str, Any]:
        """
        Extract structured data from raw text
        
        Args:
            raw_text: Raw text from job listing
            
        Returns:
            Dictionary with extracted data
        """
        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        
        extracted = {}
        
        # Extract company (usually first line)
        if lines:
            company = lines[0]
            # Clean up company name
            company = re.sub(r'\s+', ' ', company).strip()
            extracted['company'] = company
        
        # Extract title (usually after company)
        title_candidates = []
        for i, line in enumerate(lines[1:6]):  # Check first few lines after company
            if len(line) > 10 and not any(word in line.lower() for word in ['typically', 'replies', 'days', 'full time', 'part time']):
                title_candidates.append(line)
        
        if title_candidates:
            extracted['title'] = title_candidates[0]
        
        # Extract location
        location_patterns = [
            r'(Islandwide|Central|North|South|East|West)',
            r'(Singapore|SG)',
            r'(Remote|Hybrid)'
        ]
        
        for line in lines:
            for pattern in location_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    extracted['location'] = match.group(1)
                    break
            if 'location' in extracted:
                break
        
        # Extract job type
        job_type_patterns = [
            r'(Full Time|Part Time|Contract|Permanent|Temporary)',
            r'(Full-time|Part-time)'
        ]
        
        for line in lines:
            for pattern in job_type_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    extracted['job_type'] = match.group(1)
                    break
            if 'job_type' in extracted:
                break
        
        # Extract experience level
        exp_patterns = [
            r'(Senior Executive|Executive|Manager|Director|Senior Manager|Assistant Manager)',
            r'(Entry Level|Mid Level|Senior Level)',
            r'(\d+)\s*Years?\s*Exp'
        ]
        
        for line in lines:
            for pattern in exp_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    extracted['experience_level'] = match.group(1)
                    break
            if 'experience_level' in extracted:
                break
        
        # Extract industry
        industry_patterns = [
            r'(Engineering|Information Technology|Banking And Finance|Healthcare|Education|Manufacturing|Retail|Construction)',
            r'(IT|Tech|Finance|Banking|Healthcare|Education)'
        ]
        
        for line in lines:
            for pattern in industry_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    extracted['industry'] = match.group(1)
                    break
            if 'industry' in extracted:
                break
        
        # Extract post date
        date_patterns = [
            r'Posted\s+(today|yesterday|\d+\s+days?\s+ago)',
            r'(\d{1,2}\s+\w+\s+\d{4})',
            r'(\d{4}-\d{2}-\d{2})'
        ]
        
        for line in lines:
            for pattern in date_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    extracted['post_date'] = match.group(1)
                    break
            if 'post_date' in extracted:
                break
        
        return extracted
    
    def extract_salary_range_from_text(self, raw_text: str) -> Optional[tuple]:
        """
        Extract salary range from raw text
        
        Args:
            raw_text: Raw text from job listing
            
        Returns:
            Tuple of (salary_low, salary_high) or None
        """
        # Look for salary patterns
        salary_patterns = [
            r'\$(\d{1,3}(?:,\d{3})*)\s*to\s*\$(\d{1,3}(?:,\d{3})*)',
            r'\$(\d{1,3}(?:,\d{3})*)\s*-\s*\$(\d{1,3}(?:,\d{3})*)',
            r'\$(\d{1,3}(?:,\d{3})*)\s*~\s*\$(\d{1,3}(?:,\d{3})*)',
            r'\$(\d{1,3}(?:,\d{3})*)to\$(\d{1,3}(?:,\d{3})*)',  # No space between "to"
            r'(\d{1,3}(?:,\d{3})*)\s*to\s*(\d{1,3}(?:,\d{3})*)\s*monthly',
            r'(\d{1,3}(?:,\d{3})*)\s*-\s*(\d{1,3}(?:,\d{3})*)\s*monthly',
            r'(\d{1,3}(?:,\d{3})*)to(\d{1,3}(?:,\d{3})*)\s*monthly'  # No space between "to"
        ]
        
        for pattern in salary_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                try:
                    low = int(match.group(1).replace(',', ''))
                    high = int(match.group(2).replace(',', ''))
                    if low != high and low > 0 and high > 0:
                        return (low, high)
                except ValueError:
                    continue
        
        return None
    
    def generate_job_hash(self, company: str, title: str, salary_low: int, salary_high: int) -> str:
        """
        Generate a unique hash for a job
        
        Args:
            company: Company name
            title: Job title
            salary_low: Low salary
            salary_high: High salary
            
        Returns:
            MD5 hash string
        """
        hash_string = f"{company}|{title}|{salary_low}|{salary_high}"
        return hashlib.md5(hash_string.encode('utf-8')).hexdigest()
    
    def remove_duplicates_and_fix_dates(self, jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Remove duplicates based on job hash and fix post dates
        
        Args:
            jobs: List of job records
            
        Returns:
            List of deduplicated jobs with fixed dates
        """
        # Group jobs by hash
        hash_groups = defaultdict(list)
        for job in jobs:
            job_hash = job.get('job_hash')
            if job_hash:
                hash_groups[job_hash].append(job)
        
        # Keep only the newest job for each hash
        deduplicated_jobs = []
        duplicates_removed = 0
        
        for job_hash, job_group in hash_groups.items():
            if len(job_group) == 1:
                # No duplicates
                job = job_group[0]
                job['post_date'] = self.fix_post_date(job)
                deduplicated_jobs.append(job)
            else:
                # Multiple jobs with same hash - keep the newest one
                duplicates_removed += len(job_group) - 1
                
                # Sort by scraped_at timestamp (newest first)
                job_group.sort(key=lambda x: x.get('scraped_at', ''), reverse=True)
                newest_job = job_group[0]
                newest_job['post_date'] = self.fix_post_date(newest_job)
                deduplicated_jobs.append(newest_job)
        
        logger.info(f"Removed {duplicates_removed} duplicate jobs")
        return deduplicated_jobs
    
    def fix_post_date(self, job: Dict[str, Any]) -> str:
        """
        Convert relative post date to absolute date
        
        Args:
            job: Job record with post_date and scraped_at
            
        Returns:
            Absolute date string in YYYY-MM-DD format
        """
        post_date = job.get('post_date', '')
        scraped_at = job.get('scraped_at', '')
        
        # Parse scraped_at to get reference date
        try:
            scraped_datetime = datetime.fromisoformat(scraped_at.replace('Z', '+00:00'))
            reference_date = scraped_datetime.date()
        except (ValueError, AttributeError):
            # Fallback to current date
            reference_date = datetime.now().date()
        
        # Handle relative dates
        post_date_lower = post_date.lower().strip()
        
        if post_date_lower == 'today':
            return reference_date.strftime('%Y-%m-%d')
        elif post_date_lower == 'yesterday':
            target_date = reference_date - timedelta(days=1)
            return target_date.strftime('%Y-%m-%d')
        elif 'days ago' in post_date_lower:
            # Extract number of days
            match = re.search(r'(\d+)\s*days?\s*ago', post_date_lower)
            if match:
                days_ago = int(match.group(1))
                target_date = reference_date - timedelta(days=days_ago)
                return target_date.strftime('%Y-%m-%d')
        elif 'weeks ago' in post_date_lower:
            # Extract number of weeks
            match = re.search(r'(\d+)\s*weeks?\s*ago', post_date_lower)
            if match:
                weeks_ago = int(match.group(1))
                target_date = reference_date - timedelta(weeks=weeks_ago)
                return target_date.strftime('%Y-%m-%d')
        elif 'months ago' in post_date_lower:
            # Extract number of months (approximate)
            match = re.search(r'(\d+)\s*months?\s*ago', post_date_lower)
            if match:
                months_ago = int(match.group(1))
                target_date = reference_date - timedelta(days=months_ago * 30)  # Approximate
                return target_date.strftime('%Y-%m-%d')
        elif re.match(r'\d{4}-\d{2}-\d{2}', post_date):
            # Already absolute date
            return post_date
        elif re.match(r'\d{1,2}/\d{1,2}/\d{4}', post_date):
            # MM/DD/YYYY format
            try:
                parsed_date = datetime.strptime(post_date, '%m/%d/%Y').date()
                return parsed_date.strftime('%Y-%m-%d')
            except ValueError:
                pass
        
        # If we can't parse it, return the reference date
        logger.debug(f"Could not parse post_date '{post_date}', using reference date")
        return reference_date.strftime('%Y-%m-%d')
    
    def print_summary(self, original_count: int, refined_count: int, final_count: int):
        """Print summary of refinement process"""
        logger.info(f"\n=== DATA REFINEMENT SUMMARY ===")
        logger.info(f"Original jobs: {original_count}")
        logger.info(f"After refinement: {refined_count}")
        logger.info(f"After deduplication: {final_count}")
        logger.info(f"Jobs removed (quality): {original_count - refined_count}")
        logger.info(f"Jobs removed (duplicates): {refined_count - final_count}")
        logger.info(f"Total jobs removed: {original_count - final_count}")
        logger.info(f"Final retention rate: {(final_count/original_count)*100:.1f}%")

def main():
    """Main function to run data refinement"""
    refiner = DataRefiner()
    
    # Use the most recent scraped jobs file
    input_file = "output/scraped_jobs_20250918_215226.json"
    
    logger.info("Starting data refinement process...")
    
    try:
        # Load original data to get count
        with open(input_file, 'r', encoding='utf-8') as f:
            original_data = json.load(f)
        original_count = len(original_data.get('jobs', []))
        
        # Refine data
        output_file = refiner.refine_jobs(input_file)
        
        # Load refined data to get counts
        with open(output_file, 'r', encoding='utf-8') as f:
            refined_data = json.load(f)
        final_count = len(refined_data.get('jobs', []))
        refined_count = refined_data.get('metadata', {}).get('jobs_after_refinement', final_count)
        
        # Print summary
        refiner.print_summary(original_count, refined_count, final_count)
        
        logger.info(f"\nData refinement completed successfully!")
        logger.info(f"Refined data saved to: {output_file}")
        
    except Exception as e:
        logger.error(f"Data refinement failed: {str(e)}")

if __name__ == "__main__":
    main()
