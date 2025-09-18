#!/usr/bin/env python3
"""
JSON Scraper for MyCareersFuture.sg
Scrapes job data directly into JSON format with same fields as LLM output
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

class JSONScraper:
    def __init__(self):
        self.jobs = []
        
    async def scrape_jobs(self, url: str, max_pages: int = 50):
        """
        Scrape job data directly into JSON format
        """
        async with async_playwright() as p:
            # Use Firefox as it works reliably
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
                    
                    # Extract job data from current page
                    page_jobs = await self.extract_jobs_from_page(page)
                    
                    # Add all jobs without deduplication
                    self.jobs.extend(page_jobs)
                    
                    logger.info(f"Found {len(page_jobs)} jobs on page {current_page + 1} (Total so far: {len(self.jobs)})")
                    
                    # Check if we've reached the end (no more jobs)
                    if len(page_jobs) == 0:
                        logger.info("No more jobs found, stopping pagination")
                        break
                    
                    current_page += 1
                    await page.wait_for_timeout(3000)  # Increased wait between pages
                        
            except Exception as e:
                logger.error(f"Error during scraping: {str(e)}")
            finally:
                await browser.close()
                
        return self.jobs
    
    async def extract_jobs_from_page(self, page):
        """Extract job data from the current page"""
        jobs = []
        
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
                return jobs
            
            for element in job_elements:
                try:
                    job_data = await self.extract_job_data(element)
                    if job_data:
                        jobs.append(job_data)
                except Exception as e:
                    logger.warning(f"Error extracting job data: {str(e)}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error extracting jobs from page: {str(e)}")
        
        return jobs
    
    async def extract_job_data(self, element):
        """Extract structured job data from a job element"""
        try:
            job_data = {}
            
            # Extract company name
            company_selectors = [
                'span[data-testid*="company"]',
                'div[data-testid*="company"]',
                'span[class*="company"]',
                'div[class*="company"]'
            ]
            
            company = await self.extract_text_by_selectors(element, company_selectors)
            if not company:
                # Try to extract from any text that might contain company name
                full_text = await element.inner_text()
                company = self.extract_company_from_text(full_text)
            
            job_data['company'] = company or 'Unknown'
            
            # Extract job title
            title_selectors = [
                'span[data-testid*="title"]',
                'div[data-testid*="title"]',
                'h3[data-testid*="title"]',
                'span[class*="title"]',
                'div[class*="title"]',
                'h3[class*="title"]'
            ]
            
            title = await self.extract_text_by_selectors(element, title_selectors)
            job_data['title'] = title or 'Unknown'
            
            # Extract location
            location_selectors = [
                'span[data-testid*="location"]',
                'div[data-testid*="location"]',
                'span[class*="location"]',
                'div[class*="location"]'
            ]
            
            location = await self.extract_text_by_selectors(element, location_selectors)
            job_data['location'] = location or 'Unknown'
            
            # Extract salary
            salary_selectors = [
                'span[data-testid*="salary"]',
                'div[data-testid*="salary"]',
                'span[class*="salary"]',
                'div[class*="salary"]'
            ]
            
            salary_text = await self.extract_text_by_selectors(element, salary_selectors)
            salary_low, salary_high = self.parse_salary(salary_text)
            job_data['salary_low'] = salary_low
            job_data['salary_high'] = salary_high
            
            # Extract job URL
            link_element = await element.query_selector('a')
            if link_element:
                href = await link_element.get_attribute('href')
                if href:
                    if href.startswith('/'):
                        job_data['url'] = f"https://www.mycareersfuture.gov.sg{href}"
                    else:
                        job_data['url'] = href
                else:
                    job_data['url'] = 'Unknown'
            else:
                job_data['url'] = 'Unknown'
            
            # Extract industry (try to infer from URL or content)
            job_data['industry'] = self.infer_industry(job_data.get('url', ''))
            
            # Add metadata
            job_data['post_date'] = datetime.now().strftime('%Y-%m-%d')
            job_data['scraped_at'] = datetime.now().isoformat()
            job_data['raw_text'] = await element.inner_text()
            
            return job_data
            
        except Exception as e:
            logger.warning(f"Error extracting job data: {str(e)}")
            return None
    
    async def extract_text_by_selectors(self, element, selectors):
        """Try multiple selectors to extract text"""
        for selector in selectors:
            try:
                sub_element = await element.query_selector(selector)
                if sub_element:
                    text = await sub_element.inner_text()
                    if text and text.strip():
                        return text.strip()
            except:
                continue
        return None
    
    def extract_company_from_text(self, text):
        """Extract company name from full text"""
        # Look for patterns that might indicate company name
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if line and len(line) > 2 and len(line) < 100:
                # Skip common non-company words
                skip_words = ['Permanent', 'Contract', 'Full-time', 'Part-time', 'Remote', 'Hybrid']
                if not any(word in line for word in skip_words):
                    return line
        return None
    
    def parse_salary(self, salary_text):
        """Parse salary text into low and high values"""
        if not salary_text:
            return 0, 0
        
        # Remove common text and extract numbers
        salary_text = salary_text.replace(',', '').replace('$', '').replace('SGD', '').replace('S$', '')
        
        # Look for range pattern (e.g., "5000 - 8000" or "5000-8000")
        range_match = re.search(r'(\d+)\s*[-–]\s*(\d+)', salary_text)
        if range_match:
            return int(range_match.group(1)), int(range_match.group(2))
        
        # Look for single number
        single_match = re.search(r'(\d+)', salary_text)
        if single_match:
            value = int(single_match.group(1))
            return value, value
        
        return 0, 0
    
    def infer_industry(self, url):
        """Infer industry from URL"""
        if 'engineering' in url:
            return 'Engineering'
        elif 'information-technology' in url:
            return 'Information Technology'
        elif 'banking-finance' in url:
            return 'Banking And Finance'
        else:
            return 'Unknown'
    
    def update_page_url(self, base_url, page_number):
        """Update the page parameter in the URL"""
        # Replace page=X with page=page_number
        if 'page=' in base_url:
            updated_url = re.sub(r'page=\d+', f'page={page_number}', base_url)
        else:
            # Add page parameter if it doesn't exist
            separator = '&' if '?' in base_url else '?'
            updated_url = f"{base_url}{separator}page={page_number}"
        
        return updated_url
    
    def save_jobs_json(self):
        """Save all jobs to a JSON file"""
        if not self.jobs:
            logger.warning("No jobs were scraped to save.")
            return None

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"output/scraped_jobs_{timestamp}.json"
        
        # Create the final JSON structure
        output_data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "total_jobs": len(self.jobs),
                "description": "Scraped job data from MyCareersFuture.sg"
            },
            "jobs": self.jobs
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Jobs saved to: {filename}")
        return filename
    
    def print_summary(self):
        """Print summary of scraped jobs"""
        if not self.jobs:
            logger.info("No jobs scraped")
            return
        
        logger.info(f"Total jobs scraped: {len(self.jobs)}")
        
        # Show sample job
        logger.info("\nSample job:")
        if self.jobs:
            sample_job = self.jobs[0]
            logger.info(f"Company: {sample_job.get('company', 'Unknown')}")
            logger.info(f"Title: {sample_job.get('title', 'Unknown')}")
            logger.info(f"Location: {sample_job.get('location', 'Unknown')}")
            logger.info(f"Salary: ${sample_job.get('salary_low', 0)}-${sample_job.get('salary_high', 0)}")
            logger.info(f"Industry: {sample_job.get('industry', 'Unknown')}")

async def main():
    """Main function to run the JSON scraper with multiple URLs"""
    scraper = JSONScraper()
    
    # Updated URLs as specified in todo.md
    target_urls = [
        "https://www.mycareersfuture.gov.sg/job/engineering?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0",
        "https://www.mycareersfuture.gov.sg/job/information-technology?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0",
        "https://www.mycareersfuture.gov.sg/job/banking-finance?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0"
    ]
    
    logger.info("Starting MyCareersFuture.sg JSON scraper with multiple URLs...")
    
    try:
        all_jobs = []
        
        for i, target_url in enumerate(target_urls):
            logger.info(f"\n=== Scraping URL {i+1}/{len(target_urls)} ===")
            logger.info(f"URL: {target_url}")
            
            # Reset scraper for each URL
            scraper.jobs = []
            
            # Scrape jobs (50 pages for comprehensive data)
            jobs = await scraper.scrape_jobs(target_url, max_pages=50)
            
            if jobs:
                all_jobs.extend(jobs)
                logger.info(f"Scraped {len(jobs)} jobs from URL {i+1}")
            else:
                logger.warning(f"No jobs were scraped from URL {i+1}")
        
        if all_jobs:
            # Update scraper with all collected jobs
            scraper.jobs = all_jobs
            
            # Print summary
            scraper.print_summary()
            
            # Save data
            json_file = scraper.save_jobs_json()
            
            logger.info(f"\nScraping completed successfully!")
            logger.info(f"Total jobs scraped: {len(all_jobs)}")
            logger.info(f"JSON file: {json_file}")
        else:
            logger.warning("No jobs were scraped from any URL")
            
    except Exception as e:
        logger.error(f"Scraping failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
