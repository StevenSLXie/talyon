#!/usr/bin/env python3
"""
MyCareersFuture Individual Job Page Scraper
Scrapes individual job pages from MyCareersFuture.sg and parses them into JSON format
Based on the methodology from raw_text_scraper.py
"""

import asyncio
import json
import re
from datetime import datetime
import logging
from playwright.async_api import async_playwright
from typing import Dict, List, Optional

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MCFJobScraper:
    def __init__(self):
        self.scraped_jobs = []
        
    async def scrape_job_page(self, url: str) -> Optional[Dict]:
        """
        Scrape a single job page from MyCareersFuture.sg
        Returns a dictionary with structured job data
        """
        async with async_playwright() as p:
            # Use Firefox as it works reliably - same as raw_text_scraper.py
            browser = await p.firefox.launch(headless=True)
            
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0'
            )
            
            page = await context.new_page()
            
            try:
                logger.info(f"Navigating to job page: {url}")
                await page.goto(url, wait_until='networkidle', timeout=30000)
                
                # Wait for page to stabilize
                await page.wait_for_timeout(3000)
                
                # Extract job data
                job_data = await self.extract_job_data(page, url)
                
                if job_data:
                    logger.info(f"Successfully scraped job: {job_data.get('title', 'Unknown')}")
                    return job_data
                else:
                    logger.warning(f"Failed to extract job data from: {url}")
                    return None
                        
            except Exception as e:
                logger.error(f"Error scraping job page {url}: {str(e)}")
                return None
            finally:
                await browser.close()
    
    async def extract_job_data(self, page, url: str) -> Optional[Dict]:
        """Extract structured job data from the page"""
        try:
            job_data = {
                'url': url,
                'scraped_at': datetime.now().isoformat(),
                'title': None,
                'company': None,
                'location': None,
                'salary': None,
                'employment_type': None,
                'experience_level': None,
                'job_description': None,
                'requirements': None,
                'benefits': None,
                'posted_date': None,
                'application_deadline': None,
                'industry': None,
                'job_category': None,
                'raw_text': None
            }
            
            # Extract title
            title_selectors = [
                'h1[data-testid*="job-title"]',
                'h1[class*="job-title"]',
                'h1',
                '[data-testid*="title"]',
                '.job-title'
            ]
            
            for selector in title_selectors:
                try:
                    title_element = await page.query_selector(selector)
                    if title_element:
                        title = await title_element.inner_text()
                        if title and title.strip():
                            job_data['title'] = title.strip()
                            break
                except:
                    continue
            
            # Extract company name
            company_selectors = [
                '[data-testid*="company"]',
                '[class*="company"]',
                '.company-name',
                '.employer'
            ]
            
            for selector in company_selectors:
                try:
                    company_element = await page.query_selector(selector)
                    if company_element:
                        company = await company_element.inner_text()
                        if company and company.strip():
                            job_data['company'] = company.strip()
                            break
                except:
                    continue
            
            # Extract location
            location_selectors = [
                '[data-testid*="location"]',
                '[class*="location"]',
                '.location',
                '.job-location'
            ]
            
            for selector in location_selectors:
                try:
                    location_element = await page.query_selector(selector)
                    if location_element:
                        location = await location_element.inner_text()
                        if location and location.strip():
                            job_data['location'] = location.strip()
                            break
                except:
                    continue
            
            # Extract salary information
            salary_selectors = [
                '[data-testid*="salary"]',
                '[class*="salary"]',
                '.salary',
                '.job-salary'
            ]
            
            for selector in salary_selectors:
                try:
                    salary_element = await page.query_selector(selector)
                    if salary_element:
                        salary = await salary_element.inner_text()
                        if salary and salary.strip():
                            job_data['salary'] = salary.strip()
                            break
                except:
                    continue
            
            # Extract employment type
            employment_selectors = [
                '[data-testid*="employment"]',
                '[class*="employment"]',
                '.employment-type',
                '.job-type'
            ]
            
            for selector in employment_selectors:
                try:
                    employment_element = await page.query_selector(selector)
                    if employment_element:
                        employment = await employment_element.inner_text()
                        if employment and employment.strip():
                            job_data['employment_type'] = employment.strip()
                            break
                except:
                    continue
            
            # Extract job description
            description_selectors = [
                '[data-testid*="description"]',
                '[class*="description"]',
                '.job-description',
                '.description',
                'div[class*="content"]'
            ]
            
            for selector in description_selectors:
                try:
                    desc_element = await page.query_selector(selector)
                    if desc_element:
                        description = await desc_element.inner_text()
                        if description and len(description.strip()) > 50:  # Ensure it's substantial content
                            job_data['job_description'] = description.strip()
                            break
                except:
                    continue
            
            # Extract requirements
            requirements_selectors = [
                '[data-testid*="requirement"]',
                '[class*="requirement"]',
                '.requirements',
                '.job-requirements'
            ]
            
            for selector in requirements_selectors:
                try:
                    req_element = await page.query_selector(selector)
                    if req_element:
                        requirements = await req_element.inner_text()
                        if requirements and requirements.strip():
                            job_data['requirements'] = requirements.strip()
                            break
                except:
                    continue
            
            # Extract benefits
            benefits_selectors = [
                '[data-testid*="benefit"]',
                '[class*="benefit"]',
                '.benefits',
                '.job-benefits'
            ]
            
            for selector in benefits_selectors:
                try:
                    benefits_element = await page.query_selector(selector)
                    if benefits_element:
                        benefits = await benefits_element.inner_text()
                        if benefits and benefits.strip():
                            job_data['benefits'] = benefits.strip()
                            break
                except:
                    continue
            
            # Extract posted date
            date_selectors = [
                '[data-testid*="date"]',
                '[class*="date"]',
                '.posted-date',
                '.job-date'
            ]
            
            for selector in date_selectors:
                try:
                    date_element = await page.query_selector(selector)
                    if date_element:
                        date_text = await date_element.inner_text()
                        if date_text and date_text.strip():
                            job_data['posted_date'] = date_text.strip()
                            break
                except:
                    continue
            
            # Get the full page text as fallback
            try:
                full_text = await page.inner_text('body')
                if full_text:
                    job_data['raw_text'] = full_text.strip()
            except:
                pass
            
            # Extract additional metadata from URL
            url_parts = url.split('/')
            if 'job' in url_parts:
                job_index = url_parts.index('job')
                if job_index + 1 < len(url_parts):
                    job_data['job_category'] = url_parts[job_index + 1]
            
            # Clean up empty values
            job_data = {k: v for k, v in job_data.items() if v is not None and v != ''}
            
            return job_data
            
        except Exception as e:
            logger.error(f"Error extracting job data: {str(e)}")
            return None
    
    async def scrape_multiple_jobs(self, urls: List[str]) -> List[Dict]:
        """Scrape multiple job pages"""
        logger.info(f"Starting to scrape {len(urls)} job pages...")
        
        scraped_jobs = []
        for i, url in enumerate(urls):
            logger.info(f"Scraping job {i+1}/{len(urls)}: {url}")
            job_data = await self.scrape_job_page(url)
            if job_data:
                scraped_jobs.append(job_data)
            else:
                logger.warning(f"Failed to scrape job {i+1}")
        
        self.scraped_jobs = scraped_jobs
        return scraped_jobs
    
    def save_to_json(self, filename: Optional[str] = None) -> str:
        """Save scraped jobs to JSON file"""
        if not self.scraped_jobs:
            logger.warning("No jobs to save")
            return ""
        
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"output/mcf_jobs_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.scraped_jobs, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved {len(self.scraped_jobs)} jobs to {filename}")
        return filename
    
    def print_summary(self):
        """Print summary of scraped jobs"""
        if not self.scraped_jobs:
            logger.info("No jobs scraped")
            return
        
        logger.info(f"Total jobs scraped: {len(self.scraped_jobs)}")
        
        # Show sample job data
        if self.scraped_jobs:
            sample_job = self.scraped_jobs[0]
            logger.info("\nSample job data:")
            for key, value in sample_job.items():
                if key != 'raw_text':  # Skip raw text in summary
                    logger.info(f"  {key}: {value}")

async def main():
    """Main function to test the scraper"""
    scraper = MCFJobScraper()
    
    # Test with the provided URL
    test_url = "https://www.mycareersfuture.gov.sg/job/banking-finance/head-department-bank-china-2d46049fa7f44a7325795edfdc1454db?source=MCF&event=Search"
    
    logger.info("Testing MyCareersFuture job page scraper...")
    
    try:
        # Scrape the test job
        job_data = await scraper.scrape_job_page(test_url)
        
        if job_data:
            scraper.scraped_jobs = [job_data]
            
            # Print summary
            scraper.print_summary()
            
            # Save to JSON
            json_file = scraper.save_to_json()
            
            logger.info(f"\nScraping completed successfully!")
            logger.info(f"Job data saved to: {json_file}")
            
            # Print the full JSON for verification
            print("\n" + "="*50)
            print("FULL JOB DATA:")
            print("="*50)
            print(json.dumps(job_data, indent=2, ensure_ascii=False))
            
        else:
            logger.error("Failed to scrape the test job")
            
    except Exception as e:
        logger.error(f"Scraping failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
