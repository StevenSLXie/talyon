#!/usr/bin/env python3
"""
Job Consolidation Script
Reads URLs from refined_jobs.json and scrapes full job details to create a consolidated JSON
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional
from mcf_job_scraper import MCFJobScraper
import os

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class JobConsolidator:
    def __init__(self, refined_jobs_file: str):
        self.refined_jobs_file = refined_jobs_file
        self.scraper = MCFJobScraper()
        self.consolidated_jobs = []
        self.failed_urls = []
        
    def load_refined_jobs(self) -> List[Dict]:
        """Load jobs from refined_jobs.json file"""
        try:
            with open(self.refined_jobs_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            jobs = data.get('jobs', [])
            logger.info(f"Loaded {len(jobs)} jobs from {self.refined_jobs_file}")
            return jobs
            
        except Exception as e:
            logger.error(f"Error loading refined jobs file: {str(e)}")
            return []
    
    def extract_urls(self, jobs: List[Dict]) -> List[str]:
        """Extract URLs from jobs list"""
        urls = []
        for job in jobs:
            url = job.get('url')
            if url and isinstance(url, str):
                urls.append(url)
        
        logger.info(f"Extracted {len(urls)} URLs from jobs")
        return urls
    
    async def scrape_jobs_batch(self, urls: List[str], batch_size: int = 10, delay: float = 2.0) -> List[Dict]:
        """
        Scrape jobs in batches to avoid overwhelming the server
        """
        logger.info(f"Starting to scrape {len(urls)} jobs in batches of {batch_size}")
        
        all_jobs = []
        
        for i in range(0, len(urls), batch_size):
            batch_urls = urls[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(urls) + batch_size - 1) // batch_size
            
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch_urls)} jobs)")
            
            # Scrape current batch
            batch_jobs = await self.scraper.scrape_multiple_jobs(batch_urls)
            
            if batch_jobs:
                all_jobs.extend(batch_jobs)
                logger.info(f"Successfully scraped {len(batch_jobs)} jobs from batch {batch_num}")
            else:
                logger.warning(f"No jobs scraped from batch {batch_num}")
            
            # Add delay between batches to be respectful
            if i + batch_size < len(urls):  # Don't delay after the last batch
                logger.info(f"Waiting {delay} seconds before next batch...")
                await asyncio.sleep(delay)
        
        logger.info(f"Completed scraping. Total jobs scraped: {len(all_jobs)}")
        return all_jobs
    
    def merge_job_data(self, refined_job: Dict, scraped_job: Dict) -> Dict:
        """
        Merge data from refined job with scraped job data
        """
        merged_job = {
            # Keep original refined data
            'company': refined_job.get('company'),
            'title': refined_job.get('title'),
            'location': refined_job.get('location'),
            'salary_low': refined_job.get('salary_low'),
            'salary_high': refined_job.get('salary_high'),
            'industry': refined_job.get('industry'),
            'job_type': refined_job.get('job_type'),
            'experience_level': refined_job.get('experience_level'),
            'post_date': refined_job.get('post_date'),
            'job_hash': refined_job.get('job_hash'),
            
            # Add scraped data
            'url': scraped_job.get('url'),
            'scraped_at': scraped_job.get('scraped_at'),
            'employment_type': scraped_job.get('employment_type'),
            'job_description': scraped_job.get('job_description'),
            'requirements': scraped_job.get('requirements'),
            'benefits': scraped_job.get('benefits'),
            'posted_date': scraped_job.get('posted_date'),
            'job_category': scraped_job.get('job_category'),
            'raw_text': scraped_job.get('raw_text'),
            
            # Additional metadata
            'consolidated_at': datetime.now().isoformat(),
            'data_source': 'refined_jobs_consolidated'
        }
        
        # Clean up None values
        merged_job = {k: v for k, v in merged_job.items() if v is not None}
        
        return merged_job
    
    async def consolidate_jobs(self, max_jobs: Optional[int] = None, batch_size: int = 10, delay: float = 2.0) -> List[Dict]:
        """
        Main method to consolidate jobs
        """
        logger.info("Starting job consolidation process...")
        
        # Load refined jobs
        refined_jobs = self.load_refined_jobs()
        if not refined_jobs:
            logger.error("No refined jobs loaded. Exiting.")
            return []
        
        # Limit jobs if specified (useful for testing)
        if max_jobs:
            refined_jobs = refined_jobs[:max_jobs]
            logger.info(f"Limited to first {max_jobs} jobs for processing")
        
        # Extract URLs
        urls = self.extract_urls(refined_jobs)
        if not urls:
            logger.error("No URLs found in refined jobs. Exiting.")
            return []
        
        # Create URL to refined job mapping
        url_to_job = {job.get('url'): job for job in refined_jobs if job.get('url')}
        
        # Scrape jobs in batches
        scraped_jobs = await self.scrape_jobs_batch(urls, batch_size, delay)
        
        # Merge data
        consolidated_jobs = []
        for scraped_job in scraped_jobs:
            url = scraped_job.get('url')
            if url in url_to_job:
                refined_job = url_to_job[url]
                merged_job = self.merge_job_data(refined_job, scraped_job)
                consolidated_jobs.append(merged_job)
            else:
                logger.warning(f"No matching refined job found for URL: {url}")
        
        self.consolidated_jobs = consolidated_jobs
        logger.info(f"Consolidation completed. Total consolidated jobs: {len(consolidated_jobs)}")
        
        return consolidated_jobs
    
    def save_consolidated_jobs(self, filename: Optional[str] = None) -> str:
        """Save consolidated jobs to JSON file"""
        if not self.consolidated_jobs:
            logger.warning("No consolidated jobs to save")
            return ""
        
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"output/consolidated_jobs_{timestamp}.json"
        
        # Create metadata
        metadata = {
            'generated_at': datetime.now().isoformat(),
            'total_jobs': len(self.consolidated_jobs),
            'description': 'Consolidated job data with full details scraped from individual job pages',
            'source_file': self.refined_jobs_file,
            'scraper_version': '1.0'
        }
        
        output_data = {
            'metadata': metadata,
            'jobs': self.consolidated_jobs
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved {len(self.consolidated_jobs)} consolidated jobs to {filename}")
        return filename
    
    def print_summary(self):
        """Print summary of consolidation process"""
        if not self.consolidated_jobs:
            logger.info("No jobs consolidated")
            return
        
        logger.info(f"Total jobs consolidated: {len(self.consolidated_jobs)}")
        
        # Show sample job
        if self.consolidated_jobs:
            sample_job = self.consolidated_jobs[0]
            logger.info("\nSample consolidated job:")
            for key, value in sample_job.items():
                if key not in ['raw_text', 'job_description']:  # Skip long text fields
                    logger.info(f"  {key}: {value}")

async def main():
    """Main function to run the consolidation process"""
    
    # Configuration
    refined_jobs_file = "output/refined_jobs_20250918_222615.json"
    max_jobs = None  # Set to None for all jobs, or a number for testing
    batch_size = 10  # Number of jobs to scrape in each batch
    delay = 5.0     # Delay between batches in seconds
    
    logger.info("Starting job consolidation process...")
    logger.info(f"Refined jobs file: {refined_jobs_file}")
    logger.info(f"Max jobs to process: {max_jobs or 'All'}")
    logger.info(f"Batch size: {batch_size}")
    logger.info(f"Delay between batches: {delay}s")
    
    try:
        # Initialize consolidator
        consolidator = JobConsolidator(refined_jobs_file)
        
        # Consolidate jobs
        consolidated_jobs = await consolidator.consolidate_jobs(
            max_jobs=max_jobs,
            batch_size=batch_size,
            delay=delay
        )
        
        if consolidated_jobs:
            # Print summary
            consolidator.print_summary()
            
            # Save to file
            output_file = consolidator.save_consolidated_jobs()
            
            logger.info(f"\nConsolidation completed successfully!")
            logger.info(f"Total jobs processed: {len(consolidated_jobs)}")
            logger.info(f"Output file: {output_file}")
        else:
            logger.error("No jobs were consolidated")
            
    except Exception as e:
        logger.error(f"Consolidation failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
