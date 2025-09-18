#!/usr/bin/env python3
"""
Raw Text Scraper for MyCareersFuture.sg
Copies the exact working logic from final_scraper.py but saves only raw text
"""

import asyncio
import json
import pandas as pd
from datetime import datetime
import logging
from playwright.async_api import async_playwright
import re

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RawTextScraper:
    def __init__(self):
        self.raw_texts = []
        
    async def scrape_raw_texts(self, url: str, max_pages: int = 50):
        """
        Scrape raw text from job listings on MyCareersFuture.sg
        Uses the EXACT same logic as final_scraper.py
        """
        async with async_playwright() as p:
            # Use Firefox as it works reliably - EXACT SAME AS final_scraper.py
            browser = await p.firefox.launch(headless=True)
            
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0'
            )
            
            page = await context.new_page()
            
            try:
                logger.info(f"Navigating to: {url}")
                await page.goto(url, wait_until='networkidle', timeout=30000)
                
                # Wait for page to stabilize
                await page.wait_for_timeout(5000)
                
                current_page = 0
                while current_page < max_pages:
                    logger.info(f"Scraping page {current_page + 1}/{max_pages} (Progress: {((current_page + 1) / max_pages * 100):.1f}%)")
                    
                    # Navigate to the specific page URL
                    page_url = self.update_page_url(url, current_page)
                    if page_url != url:  # Only navigate if URL changed
                        logger.info(f"Navigating to page {current_page}: {page_url}")
                        await page.goto(page_url, wait_until='domcontentloaded', timeout=60000)
                        await page.wait_for_load_state('networkidle', timeout=60000)
                        await page.wait_for_timeout(3000)  # Increased wait for stability
                    
                    # Extract raw text from current page
                    page_texts = await self.extract_raw_texts_from_page(page)
                    
                    # Add all texts without deduplication
                    self.raw_texts.extend(page_texts)
                    
                    logger.info(f"Found {len(page_texts)} raw texts on page {current_page + 1} (Total so far: {len(self.raw_texts)})")
                    
                    current_page += 1
                    await page.wait_for_timeout(3000)  # Increased wait between pages
                        
            except Exception as e:
                logger.error(f"Error during scraping: {str(e)}")
            finally:
                await browser.close()
                
        return self.raw_texts
    
    async def extract_raw_texts_from_page(self, page):
        """Extract raw text from the current page - IMPROVED TO HANDLE FRAGMENTED JOBS"""
        texts = []
        
        try:
            # Try different selectors to find job card containers
            selectors_to_try = [
                'div[data-testid*="job-card"]',  # Job card containers
                'div[data-testid*="job"]',       # Individual job elements
                'article[data-testid*="job"]',   # Article containers
                'div[class*="job"]',             # Class-based selectors
            ]
            
            job_elements = []
            for selector in selectors_to_try:
                elements = await page.query_selector_all(selector)
                if elements:
                    logger.info(f"Found {len(elements)} elements with selector: {selector}")
                    job_elements = elements
                    break
            
            if not job_elements:
                logger.warning("No job elements found with any selector")
                return texts
            
            # Process each job element
            for element in job_elements:
                try:
                    # Get the complete text content of the job element
                    raw_text = await element.inner_text()
                    if not raw_text or len(raw_text.strip()) < 20:
                        continue
                    
                    # Clean up the text
                    raw_text = raw_text.strip()
                    
                    # Extract job URL
                    job_url = None
                    try:
                        link = await element.query_selector('a')
                        if link:
                            href = await link.get_attribute('href')
                            if href:
                                if not href.startswith('http'):
                                    href = 'https://www.mycareersfuture.gov.sg' + href
                                job_url = href
                    except:
                        pass
                    
                    # Add URL to the raw text if found
                    if job_url:
                        raw_text = f"{raw_text}\n\nJOB_URL: {job_url}"
                    
                    # Add the raw text without deduplication
                    texts.append(raw_text)
                        
                except Exception as e:
                    logger.warning(f"Error extracting raw text: {str(e)}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error extracting raw texts from page: {str(e)}")
            
        logger.info(f"Extracted {len(texts)} raw texts from page")
        return texts
    
    def update_page_url(self, base_url, page_number):
        """Update the page parameter in the URL - EXACT SAME AS final_scraper.py"""
        import re
        
        # Replace page=X with page=page_number
        if 'page=' in base_url:
            updated_url = re.sub(r'page=\d+', f'page={page_number}', base_url)
        else:
            # Add page parameter if it doesn't exist
            separator = '&' if '?' in base_url else '?'
            updated_url = f"{base_url}{separator}page={page_number}"
        
        return updated_url
    
    def save_raw_texts(self):
        """Save all raw texts to a single file in the input folder"""
        if not self.raw_texts:
            logger.warning("No raw texts were scraped to save.")
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"input/raw_job_texts_{timestamp}.txt"
        
        # Save all raw texts to a single file
        with open(filename, 'w', encoding='utf-8') as f:
            for i, text in enumerate(self.raw_texts):
                f.write(f"=== JOB {i+1} ===\n")
                f.write(text)
                f.write(f"\n\n{'='*50}\n\n")
        
        logger.info(f"Raw texts saved to {filename}")
        logger.info(f"Total raw texts: {len(self.raw_texts)}")
        
        return filename
    
    def print_summary(self):
        """Print summary of scraped raw texts"""
        if not self.raw_texts:
            logger.info("No raw texts scraped")
            return
        
        logger.info(f"Total raw texts scraped: {len(self.raw_texts)}")
        
        # Show sample raw text
        logger.info("\nSample raw text:")
        if self.raw_texts:
            sample_text = self.raw_texts[0]
            logger.info(f"\nFirst job raw text:")
            logger.info(f"{sample_text[:500]}..." if len(sample_text) > 500 else sample_text)

async def main():
    """Main function to run the raw text scraper with multiple URLs"""
    scraper = RawTextScraper()
    
    # Updated URLs as specified in todo.md
    target_urls = [
        "https://www.mycareersfuture.gov.sg/job/engineering?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0",
        "https://www.mycareersfuture.gov.sg/job/information-technology?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0",
        "https://www.mycareersfuture.gov.sg/job/banking-finance?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0"
    ]
    
    logger.info("Starting MyCareersFuture.sg raw text scraper with multiple URLs...")
    
    try:
        all_raw_texts = []
        
        for i, target_url in enumerate(target_urls):
            logger.info(f"\n=== Scraping URL {i+1}/{len(target_urls)} ===")
            logger.info(f"URL: {target_url}")
            
            # Reset scraper for each URL
            scraper.raw_texts = []
            
            # Scrape raw texts (50 pages for comprehensive data)
            raw_texts = await scraper.scrape_raw_texts(target_url, max_pages=50)
            
            if raw_texts:
                all_raw_texts.extend(raw_texts)
                logger.info(f"Scraped {len(raw_texts)} jobs from URL {i+1}")
            else:
                logger.warning(f"No raw texts were scraped from URL {i+1}")
        
        if all_raw_texts:
            # Update scraper with all collected texts
            scraper.raw_texts = all_raw_texts
            
            # Print summary
            scraper.print_summary()
            
            # Save data
            txt_file = scraper.save_raw_texts()
            
            logger.info(f"\nScraping completed successfully!")
            logger.info(f"Total jobs scraped: {len(all_raw_texts)}")
            logger.info(f"Raw text file: {txt_file}")
        else:
            logger.warning("No raw texts were scraped from any URL")
            
    except Exception as e:
        logger.error(f"Scraping failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())