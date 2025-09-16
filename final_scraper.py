#!/usr/bin/env python3
"""
Final MyCareersFuture.sg Job Scraper
Successfully extracts job listings using Firefox and Playwright
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

class MyCareersFutureScraper:
    def __init__(self):
        self.jobs_data = []
        self.seen_jobs_global = set()  # Track all seen jobs across pages
        
    async def scrape_jobs(self, url: str, max_pages: int = 3):
        """
        Scrape job listings from MyCareersFuture.sg
        
        Args:
            url: The search URL to scrape
            max_pages: Maximum number of pages to scrape
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
                    
                    # Add only new jobs (deduplicate across pages)
                    new_jobs = []
                    for job in page_jobs:
                        job_key = self.create_job_key(job)
                        if job_key not in self.seen_jobs_global:
                            self.seen_jobs_global.add(job_key)
                            new_jobs.append(job)
                    
                    self.jobs_data.extend(new_jobs)
                    
                    logger.info(f"Found {len(page_jobs)} jobs on page {current_page + 1} (Total so far: {len(self.jobs_data)})")
                    
                    current_page += 1
                    await page.wait_for_timeout(3000)  # Increased wait between pages
                        
            except Exception as e:
                logger.error(f"Error during scraping: {str(e)}")
            finally:
                await browser.close()
                
        return self.jobs_data
    
    async def extract_jobs_from_page(self, page):
        """Extract job information from the current page"""
        jobs = []
        seen_jobs = set()  # Track seen jobs to avoid duplicates
        
        try:
            # Find job elements using the selector that worked
            job_elements = await page.query_selector_all('[data-testid*="job"]')
            
            logger.info(f"Found {len(job_elements)} job elements")
            
            for element in job_elements:
                try:
                    job_data = await self.extract_job_data(element)
                    if job_data and self.is_valid_job(job_data):
                        # Create a unique key for deduplication
                        job_key = self.create_job_key(job_data)
                        if job_key not in seen_jobs:
                            seen_jobs.add(job_key)
                            jobs.append(job_data)
                except Exception as e:
                    logger.warning(f"Error extracting job data: {str(e)}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error extracting jobs from page: {str(e)}")
            
        logger.info(f"After deduplication: {len(jobs)} unique jobs")
        return jobs
    
    async def extract_job_data(self, element):
        """Extract individual job data from a job element"""
        job_data = {}
        
        try:
            # Get the full text content
            raw_text = await element.inner_text()
            if not raw_text or len(raw_text.strip()) < 20:
                return None
            
            # Parse the structured data from the text
            job_data = self.parse_job_text(raw_text)
            
            # Get the job URL
            try:
                link = await element.query_selector('a')
                if link:
                    href = await link.get_attribute('href')
                    if href:
                        if not href.startswith('http'):
                            href = 'https://www.mycareersfuture.gov.sg' + href
                        job_data['job_url'] = href
            except:
                pass
            
            # Add scraping timestamp
            job_data['scraped_at'] = datetime.now().isoformat()
            
            return job_data
            
        except Exception as e:
            logger.warning(f"Error extracting individual job data: {str(e)}")
            return None
    
    def parse_job_text(self, text):
        """Parse job information from the raw text"""
        job_data = {}
        
        # Split text into lines and clean them
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        if len(lines) < 3:
            return None
        
        # Company name is usually the first line
        job_data['company'] = lines[0]
        
        # Job title logic: skip "TYPICALLY REPLIES IN X DAYS" if present
        title_candidates = []
        for i, line in enumerate(lines[1:], 1):  # Start from second line
            # Skip response time indicators
            if 'TYPICALLY REPLIES' in line or 'REPLIES IN' in line:
                continue
            # Skip very short lines (likely not job titles)
            if len(line) < 5:
                continue
            # Skip location keywords
            if line in ['North', 'South', 'East', 'West', 'Central', 'Singapore', 'Islandwide']:
                continue
            # Skip job type keywords
            if line in ['Full Time', 'Part Time', 'Contract', 'Temporary', 'Internship', 'Permanent']:
                continue
            # Skip experience level keywords
            if line in ['Professional', 'Executive', 'Senior Executive', 'Senior Management', 'Junior Executive']:
                continue
            
            title_candidates.append(line)
            # Take the first good candidate as the job title
            if len(title_candidates) == 1:
                break
        
        # Use the first valid title candidate, or fallback to second line
        if title_candidates:
            job_data['title'] = title_candidates[0]
        else:
            job_data['title'] = lines[1] if len(lines) > 1 else "Unknown"
        
        # Look for location (usually contains area names)
        location_keywords = ['North', 'South', 'East', 'West', 'Central', 'Singapore']
        for line in lines:
            if any(keyword in line for keyword in location_keywords):
                job_data['location'] = line
                break
        
        # Look for job type
        job_type_keywords = ['Full Time', 'Part Time', 'Contract', 'Temporary', 'Internship']
        for line in lines:
            if any(keyword in line for keyword in job_type_keywords):
                job_data['job_type'] = line
                break
        
        # Look for salary information
        salary_pattern = r'\$[\d,]+(?:to\$[\d,]+)?'
        for line in lines:
            if re.search(salary_pattern, line):
                job_data['salary'] = line
                break
        
        # Look for posted date
        date_keywords = ['Posted', 'today', 'yesterday', 'days ago', 'week ago']
        for line in lines:
            if any(keyword in line.lower() for keyword in date_keywords):
                job_data['posted_date'] = line
                break
        
        # Store the raw text for reference
        job_data['raw_text'] = text
        
        return job_data
    
    def update_page_url(self, base_url, page_number):
        """Update the page parameter in the URL"""
        import re
        
        # Replace page=X with page=page_number
        if 'page=' in base_url:
            updated_url = re.sub(r'page=\d+', f'page={page_number}', base_url)
        else:
            # Add page parameter if it doesn't exist
            separator = '&' if '?' in base_url else '?'
            updated_url = f"{base_url}{separator}page={page_number}"
        
        return updated_url
    
    def create_job_key(self, job_data):
        """Create a unique key for job deduplication"""
        # Use company + title + URL as the unique key
        company = job_data.get('company', '').strip()
        title = job_data.get('title', '').strip()
        url = job_data.get('job_url', '').strip()
        
        # If we have a URL, use it as primary key
        if url:
            return url
        
        # Otherwise use company + title
        return f"{company}|{title}"
    
    def is_valid_job(self, job_data):
        """Check if the job data is valid and complete enough"""
        # Must have company and title
        company = job_data.get('company', '').strip()
        title = job_data.get('title', '').strip()
        
        if not company or not title:
            return False
        
        # Company and title should be different
        if company == title:
            return False
        
        # Company should not be a location (common parsing error)
        location_keywords = ['North', 'South', 'East', 'West', 'Central', 'Singapore', 'Islandwide']
        if company in location_keywords:
            return False
        
        # Title should not be a job type (common parsing error)
        job_type_keywords = ['Full Time', 'Part Time', 'Contract', 'Temporary', 'Internship', 'Permanent']
        if title in job_type_keywords:
            return False
        
        # Should have some additional information
        additional_fields = ['location', 'job_type', 'salary', 'posted_date']
        has_additional = any(job_data.get(field) for field in additional_fields)
        
        return has_additional
    
    
    def save_to_json(self, filename: str = None):
        """Save scraped data to JSON file"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"mycareersfuture_jobs_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.jobs_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Data saved to {filename}")
        return filename
    
    def save_to_csv(self, filename: str = None):
        """Save scraped data to CSV file"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"mycareersfuture_jobs_{timestamp}.csv"
        
        if self.jobs_data:
            df = pd.DataFrame(self.jobs_data)
            df.to_csv(filename, index=False, encoding='utf-8')
            logger.info(f"Data saved to {filename}")
            return filename
        else:
            logger.warning("No data to save")
            return None
    
    def print_summary(self):
        """Print summary of scraped data"""
        if not self.jobs_data:
            logger.info("No jobs scraped")
            return
        
        logger.info(f"Total jobs scraped: {len(self.jobs_data)}")
        
        # Count by company
        companies = {}
        for job in self.jobs_data:
            company = job.get('company', 'Unknown')
            companies[company] = companies.get(company, 0) + 1
        
        logger.info("Top companies by job count:")
        for company, count in sorted(companies.items(), key=lambda x: x[1], reverse=True)[:10]:
            logger.info(f"  {company}: {count} jobs")
        
        # Show sample jobs
        logger.info("\nSample jobs:")
        for i, job in enumerate(self.jobs_data[:3]):
            logger.info(f"\nJob {i+1}:")
            logger.info(f"  Company: {job.get('company', 'N/A')}")
            logger.info(f"  Title: {job.get('title', 'N/A')}")
            logger.info(f"  Location: {job.get('location', 'N/A')}")
            logger.info(f"  Job Type: {job.get('job_type', 'N/A')}")
            logger.info(f"  Salary: {job.get('salary', 'N/A')}")
            logger.info(f"  Posted: {job.get('posted_date', 'N/A')}")
            logger.info(f"  URL: {job.get('job_url', 'N/A')}")

async def main():
    """Main function to run the scraper"""
    scraper = MyCareersFutureScraper()
    
    # Target URL from the user
    target_url = "https://www.mycareersfuture.gov.sg/search?salary=6000&postingCompany=Direct&sortBy=new_posting_date&page=0"
    
    logger.info("Starting MyCareersFuture.sg job scraper...")
    
    try:
        # Scrape jobs (50 pages for comprehensive data)
        jobs = await scraper.scrape_jobs(target_url, max_pages=50)
        
        if jobs:
            # Print summary
            scraper.print_summary()
            
            # Save data
            json_file = scraper.save_to_json()
            csv_file = scraper.save_to_csv()
            
            logger.info(f"\nScraping completed successfully!")
            logger.info(f"JSON file: {json_file}")
            logger.info(f"CSV file: {csv_file}")
        else:
            logger.warning("No jobs were scraped")
            
    except Exception as e:
        logger.error(f"Scraping failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
