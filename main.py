#!/usr/bin/env python3
"""
Main orchestrator script for the MyCareersFuture.sg job scraper pipeline.

This script runs the complete pipeline:
1. Scrape raw job texts from the website
2. Parse raw texts using GPT-4o-mini
3. Save structured data to JSON and CSV

Usage:
    python main.py [--pages N] [--skip-scraping]

Environment Variables Required:
    OPENAI_API_KEY: Your OpenAI API key
"""

import asyncio
import argparse
import logging
import os
from datetime import datetime
from raw_text_scraper import RawTextScraper
from llm_parser import LLMJobParser

# Configure logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def run_scraping_pipeline(pages=200, skip_scraping=False):
    """
    Run the complete scraping and parsing pipeline
    """
    logger.info("="*60)
    logger.info("MyCareersFuture.sg Job Scraper Pipeline")
    logger.info("="*60)
    
    # Step 1: Scrape raw texts (unless skipped)
    raw_text_file = None
    if not skip_scraping:
        logger.info("Step 1: Scraping raw job texts...")
        scraper = RawTextScraper()
        target_url = "https://www.mycareersfuture.gov.sg/search?salary=6000&postingCompany=Direct&sortBy=new_posting_date&page=0"
        
        try:
            raw_texts = await scraper.scrape_raw_texts(target_url, max_pages=pages)
            if raw_texts:
                # Save the raw texts to file
                raw_text_file = scraper.save_raw_texts()
                logger.info(f"Raw texts saved to: {raw_text_file}")
            else:
                logger.error("No raw texts were scraped")
                return
        except Exception as e:
            logger.error(f"Scraping failed: {str(e)}")
            return
    else:
        logger.info("Step 1: Skipping scraping, using existing raw text file...")
        # Find the most recent raw text file
        input_files = [f for f in os.listdir('input') if f.startswith('raw_job_texts_') and f.endswith('.txt')]
        if input_files:
            latest_file = sorted(input_files)[-1]
            raw_text_file = f"input/{latest_file}"
            logger.info(f"Using existing file: {raw_text_file}")
        else:
            logger.error("No existing raw text file found in input folder")
            return
    
    # Step 2: Parse raw texts using LLM
    logger.info("Step 2: Parsing raw texts using GPT-4o-mini...")
    
    # Check for OpenAI API key
    if not os.getenv('OPENAI_API_KEY'):
        logger.error("OPENAI_API_KEY environment variable not set!")
        logger.error("Please create a .env file with your OpenAI API key:")
        logger.error("OPENAI_API_KEY=your_api_key_here")
        return
    
    try:
        parser = LLMJobParser()
        parsed_jobs = parser.parse_raw_texts(raw_text_file)
        
        if parsed_jobs:
            logger.info(f"Successfully parsed {len(parsed_jobs)} jobs")
            
            # Print summary
            logger.info("\n" + "="*60)
            logger.info("PIPELINE COMPLETED SUCCESSFULLY!")
            logger.info("="*60)
            logger.info(f"Total jobs processed: {len(parsed_jobs)}")
            logger.info(f"Raw text file: {raw_text_file}")
            logger.info("Output files saved in 'output/' folder:")
            
            # List output files
            output_files = [f for f in os.listdir('output') if f.startswith('parsed_jobs_')]
            for file in sorted(output_files):
                logger.info(f"  - {file}")
                
        else:
            logger.error("No jobs were parsed successfully")
            
    except Exception as e:
        logger.error(f"Parsing failed: {str(e)}")

def main():
    """Main function with command line argument parsing"""
    parser = argparse.ArgumentParser(description='MyCareersFuture.sg Job Scraper Pipeline')
    parser.add_argument('--pages', type=int, default=200, 
                       help='Number of pages to scrape (default: 200)')
    parser.add_argument('--skip-scraping', action='store_true',
                       help='Skip scraping and use existing raw text file')
    parser.add_argument('--all', action='store_true',
                       help='Run complete pipeline (scraping + parsing)')
    
    args = parser.parse_args()
    
    # Run the pipeline
    if args.all:
        logger.info("Running complete pipeline (scraping + parsing)")
        asyncio.run(run_scraping_pipeline(pages=args.pages, skip_scraping=False))
    else:
        asyncio.run(run_scraping_pipeline(pages=args.pages, skip_scraping=args.skip_scraping))

if __name__ == "__main__":
    main()
