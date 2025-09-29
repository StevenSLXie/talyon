#!/usr/bin/env python3
"""
Test script for MCF Job Scraper
Demonstrates how to scrape multiple job pages
"""

import asyncio
import logging
from mcf_job_scraper import MCFJobScraper

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_multiple_jobs():
    """Test scraping multiple job pages"""
    scraper = MCFJobScraper()
    
    # Example URLs - you can add more job URLs here
    test_urls = [
        "https://www.mycareersfuture.gov.sg/job/banking-finance/head-department-bank-china-2d46049fa7f44a7325795edfdc1454db?source=MCF&event=Search",
        # Add more URLs here as needed
    ]
    
    logger.info(f"Testing scraper with {len(test_urls)} job URLs...")
    
    try:
        # Scrape multiple jobs
        jobs = await scraper.scrape_multiple_jobs(test_urls)
        
        if jobs:
            # Print summary
            scraper.print_summary()
            
            # Save to JSON
            json_file = scraper.save_to_json()
            
            logger.info(f"\nScraping completed successfully!")
            logger.info(f"Total jobs scraped: {len(jobs)}")
            logger.info(f"Jobs saved to: {json_file}")
            
            # Show first job details
            if jobs:
                logger.info("\nFirst job details:")
                first_job = jobs[0]
                for key, value in first_job.items():
                    if key != 'raw_text':  # Skip raw text in summary
                        logger.info(f"  {key}: {value}")
        else:
            logger.error("No jobs were scraped")
            
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_multiple_jobs())

