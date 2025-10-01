#!/usr/bin/env python3
"""
Simplified Unified Job Pipeline
Based on the working raw_text_scraper.py approach
"""

import asyncio
import json
import logging
import os
import sys
import hashlib
import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import openai
from supabase import create_client, Client
from playwright.async_api import async_playwright
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SimplifiedJobPipeline:
    def __init__(self):
        # Environment setup
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        
        if not all([self.supabase_url, self.supabase_key, self.openai_api_key]):
            raise ValueError("Missing required environment variables")
        
        # Initialize clients
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.openai_client = openai.OpenAI(api_key=self.openai_api_key)
        
        # Pipeline state
        self.raw_jobs = []
        self.enhanced_jobs = []
        self.failed_jobs = []
        
        # Statistics
        self.stats = {
            'raw_scraped': 0,
            'enhanced': 0,
            'database_stored': 0,
            'failed': 0
        }

    async def run_pipeline(self, max_pages: int = 3, max_jobs_per_url: int = 20, save_to_database: bool = True):
        """Run the simplified pipeline"""
        logger.info("🚀 Starting Simplified Job Pipeline")
        logger.info("=" * 60)
        
        # URLs from raw_text_scraper.py
        search_urls = [
            "https://www.mycareersfuture.gov.sg/job/engineering?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0",
            "https://www.mycareersfuture.gov.sg/job/information-technology?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0",
            "https://www.mycareersfuture.gov.sg/job/banking-finance?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0"
        ]
        
        try:
            # Step 1: Scrape jobs (using exact same approach as raw_text_scraper.py)
            logger.info("📊 Step 1: Scraping Jobs")
            await self.scrape_jobs(search_urls, max_pages, max_jobs_per_url)
            
            # Step 2: Enhance with LLM
            logger.info("🤖 Step 2: LLM Enhancement")
            await self.enhance_jobs()
            
            # Step 3: Save to JSON and Database
            logger.info("💾 Step 3: Storage")
            await self.save_results(save_to_database)
            
            # Final Report
            self.print_final_report()
            
        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            raise

    async def scrape_jobs(self, search_urls: List[str], max_pages: int, max_jobs_per_url: int):
        """Scrape jobs using the exact same approach as raw_text_scraper.py"""
        logger.info(f"Scraping jobs from {len(search_urls)} URLs")
        logger.info(f"Max pages per URL: {max_pages}, Max jobs per URL: {max_jobs_per_url}")
        
        async with async_playwright() as p:
            browser = await p.firefox.launch(headless=True)
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0'
            )
            page = await context.new_page()
            
            try:
                for url_index, search_url in enumerate(search_urls):
                    logger.info(f"Scraping URL {url_index + 1}/{len(search_urls)}: {search_url}")
                    
                    # Reset jobs for this URL
                    url_jobs = []
                    
                    await page.goto(search_url, wait_until='networkidle', timeout=30000)
                    await page.wait_for_timeout(5000)  # Wait for page to stabilize
                    
                    current_page = 0
                    while current_page < max_pages and len(url_jobs) < max_jobs_per_url:
                        logger.info(f"Scraping page {current_page + 1}/{max_pages} (Jobs so far: {len(url_jobs)})")
                        
                        # Navigate to the specific page URL (EXACT SAME AS raw_text_scraper.py)
                        page_url = self.update_page_url(search_url, current_page)
                        if page_url != search_url or current_page > 0:
                            logger.info(f"Navigating to page {current_page}: {page_url}")
                            await page.goto(page_url, wait_until='domcontentloaded', timeout=60000)
                            await page.wait_for_load_state('networkidle', timeout=60000)
                            await page.wait_for_timeout(3000)
                        
                        # Extract jobs from current page (EXACT SAME APPROACH)
                        page_jobs = await self.extract_jobs_from_page(page)
                        
                        # Limit jobs per URL
                        if len(url_jobs) + len(page_jobs) > max_jobs_per_url:
                            page_jobs = page_jobs[:max_jobs_per_url - len(url_jobs)]
                        
                        url_jobs.extend(page_jobs)
                        
                        logger.info(f"Found {len(page_jobs)} jobs on this page (Total from URL: {len(url_jobs)})")
                        
                        # Check if we've reached the limit
                        if len(url_jobs) >= max_jobs_per_url:
                            logger.info(f"Reached job limit ({max_jobs_per_url}) for this URL")
                            break
                        
                        current_page += 1
                        await page.wait_for_timeout(3000)  # Wait between pages
                    
                    # Add URL jobs to total
                    self.raw_jobs.extend(url_jobs)
                    logger.info(f"✅ Completed URL {url_index + 1}: {len(url_jobs)} jobs")
                    
                    # Small delay between URLs
                    await asyncio.sleep(2)
                
                self.stats['raw_scraped'] = len(self.raw_jobs)
                logger.info(f"✅ Total scraped: {len(self.raw_jobs)} jobs")
                
            finally:
                await browser.close()

    def update_page_url(self, base_url: str, page_number: int) -> str:
        """Update the page parameter in the URL - EXACT SAME AS raw_text_scraper.py"""
        # Replace page=X with page=page_number
        if 'page=' in base_url:
            updated_url = re.sub(r'page=\d+', f'page={page_number}', base_url)
        else:
            # Add page parameter if it doesn't exist
            separator = '&' if '?' in base_url else '?'
            updated_url = f"{base_url}{separator}page={page_number}"
        
        return updated_url

    async def extract_jobs_from_page(self, page) -> List[Dict]:
        """Extract jobs from current page - EXACT SAME APPROACH AS raw_text_scraper.py"""
        jobs = []
        
        try:
            # Try different selectors to find job card containers (EXACT SAME AS raw_text_scraper.py)
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
            
            # Process each job element (EXACT SAME APPROACH)
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
                    
                    # Parse the raw text to extract structured data
                    job_data = self.parse_job_text(raw_text)
                    
                    if not job_data.get('title') or not job_data.get('company'):
                        continue
                    
                    # Generate job hash for deduplication
                    job_hash = hashlib.md5(f"{job_data['title']}_{job_data['company']}_{job_data.get('location', '')}".encode()).hexdigest()
                    
                    job_record = {
                        'title': job_data['title'],
                        'company': job_data['company'],
                        'location': job_data.get('location', ''),
                        'salary_text': job_data.get('salary_text', ''),
                        'salary_low': job_data.get('salary_low', 0),
                        'salary_high': job_data.get('salary_high', 0),
                        'url': job_url,
                        'job_hash': job_hash,
                        'scraped_at': datetime.now().isoformat(),
                        'source': 'mycareersfuture',
                        'raw_text': raw_text
                    }
                    
                    jobs.append(job_record)
                        
                except Exception as e:
                    logger.warning(f"Error extracting job: {str(e)}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error extracting jobs from page: {e}")
            
        logger.info(f"Extracted {len(jobs)} jobs from page")
        return jobs

    def parse_job_text(self, raw_text: str) -> Dict:
        """Parse raw job text to extract structured data"""
        lines = raw_text.split('\n')
        job_data = {}
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            # Extract title (usually first non-empty line)
            if not job_data.get('title') and len(line) > 5 and len(line) < 100:
                job_data['title'] = line
            
            # Extract company (look for company patterns)
            elif not job_data.get('company') and any(keyword in line.lower() for keyword in ['pte', 'ltd', 'inc', 'corp', 'group', 'singapore']):
                job_data['company'] = line
            
            # Extract location (look for location patterns)
            elif not job_data.get('location') and any(keyword in line.lower() for keyword in ['singapore', 'central', 'east', 'west', 'north', 'south']):
                job_data['location'] = line
            
            # Extract salary (look for salary patterns)
            elif not job_data.get('salary_text') and ('$' in line or 'salary' in line.lower() or 'k' in line):
                job_data['salary_text'] = line
                salary_low, salary_high = self.parse_salary(line)
                job_data['salary_low'] = salary_low
                job_data['salary_high'] = salary_high
        
        return job_data

    def parse_salary(self, salary_text: str) -> tuple:
        """Parse salary text to extract min/max values"""
        if not salary_text:
            return 0, 0
        
        # Extract numbers from salary text
        numbers = re.findall(r'\d+(?:,\d{3})*', salary_text.replace(',', ''))
        
        if len(numbers) >= 2:
            return int(numbers[0]), int(numbers[1])
        elif len(numbers) == 1:
            return int(numbers[0]), int(numbers[0])
        else:
            return 0, 0

    async def enhance_jobs(self):
        """Enhance jobs with LLM analysis"""
        logger.info("Enhancing jobs with LLM analysis")
        
        batch_size = 3
        for i in range(0, len(self.raw_jobs), batch_size):
            batch = self.raw_jobs[i:i + batch_size]
            logger.info(f"Processing batch {i//batch_size + 1}/{(len(self.raw_jobs) + batch_size - 1)//batch_size}")
            
            for job in batch:
                try:
                    enhanced_data = await self.enhance_job_with_llm(job)
                    
                    if enhanced_data:
                        enhanced_job = job.copy()
                        enhanced_job['enhanced_data'] = enhanced_data
                        enhanced_job['enhanced_at'] = datetime.now().isoformat()
                        enhanced_job['status'] = 'success'
                        self.enhanced_jobs.append(enhanced_job)
                    else:
                        enhanced_job = job.copy()
                        enhanced_job['status'] = 'failed'
                        enhanced_job['error'] = 'LLM enhancement failed'
                        self.failed_jobs.append(enhanced_job)
                    
                    # Small delay between LLM calls
                    await asyncio.sleep(0.5)
                    
                except Exception as e:
                    logger.warning(f"Failed to enhance job {job['title']}: {e}")
                    enhanced_job = job.copy()
                    enhanced_job['status'] = 'failed'
                    enhanced_job['error'] = str(e)
                    self.failed_jobs.append(enhanced_job)
            
            # Delay between batches
            await asyncio.sleep(2)
        
        self.stats['enhanced'] = len(self.enhanced_jobs)
        self.stats['failed'] = len(self.failed_jobs)
        logger.info(f"✅ Enhanced {len(self.enhanced_jobs)} jobs, {len(self.failed_jobs)} failed")

    async def enhance_job_with_llm(self, job: Dict) -> Optional[Dict]:
        """Enhance job with LLM analysis"""
        try:
            prompt = self.build_enhancement_prompt(job)
            
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert job analyst specializing in the Singapore job market. Extract structured data from job descriptions and return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            enhanced_data = json.loads(response.choices[0].message.content)
            return enhanced_data
            
        except Exception as e:
            logger.warning(f"LLM enhancement failed: {e}")
            return None

    def build_enhancement_prompt(self, job: Dict) -> str:
        """Build LLM prompt for job enhancement"""
        return f"""
        Analyze this job posting and extract structured data in JSON format.
        
        Job Title: {job.get('title', '')}
        Company: {job.get('company', '')}
        Location: {job.get('location', '')}
        Salary: ${job.get('salary_low', 0)} - ${job.get('salary_high', 0)}
        
        Raw Job Text:
        {job.get('raw_text', '')[:1500]}
        
        Extract and return this JSON structure:
        {{
            "company_tier": "MNC|GLC|Educational Institution|SME",
            "title_clean": "Normalized job title",
            "job_family": "Engineering|IT|Finance|Marketing|Operations|Sales|HR|Other",
            "seniority_level": "Entry|Mid|Senior|Lead|Manager|Director|Executive",
            "remote_policy": "Onsite|Hybrid|Remote",
            "visa_requirement": {{
                "local_only": false,
                "ep_ok": true,
                "sp_ok": false,
                "wp_ok": false
            }},
            "experience_years_req": {{
                "min": 3,
                "max": 5
            }},
            "education_req": ["Bachelor's degree", "Master's degree preferred"],
            "certifications_req": ["AWS Certified", "PMP"],
            "skills_required": [
                {{"name": "Python", "level": 4}},
                {{"name": "React", "level": 3}}
            ],
            "skills_optional": ["Docker", "Kubernetes"],
            "job_functions": ["Software Development", "Code Review", "Team Leadership"],
            "currency": "SGD",
            "expires_at": "2024-12-31",
            "trust_score": 0.85,
            "source_site": "MyCareersFuture",
            "source_url": "{job.get('url', '')}"
        }}
        
        Guidelines:
        - Company tier: MNC for multinationals, GLC for government-linked companies, Educational Institution for schools/universities, SME for others
        - Skills levels: 1=Beginner, 2=Intermediate, 3=Advanced, 4=Expert, 5=Master
        - Experience years: Extract from job description or infer from seniority level
        - Education: Extract specific degree requirements
        - Certifications: Extract specific certification requirements
        - Skills: Focus on technical and professional skills mentioned
        - Job functions: Core responsibilities and duties
        """

    async def save_results(self, save_to_database: bool):
        """Save results to JSON and optionally to database"""
        logger.info("Saving results")
        
        # Save to JSON
        await self.save_to_json()
        
        # Save to database if requested
        if save_to_database:
            await self.save_to_database()
        
        logger.info("✅ Storage completed")

    async def save_to_json(self):
        """Save enhanced jobs to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        output_data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "pipeline_version": "1.0",
                "total_raw": self.stats['raw_scraped'],
                "total_enhanced": self.stats['enhanced'],
                "total_failed": self.stats['failed'],
                "description": "Simplified job pipeline results with LLM enhancement"
            },
            "enhanced_jobs": self.enhanced_jobs,
            "failed_jobs": self.failed_jobs
        }
        
        filename = f"output/simplified_pipeline_{timestamp}.json"
        os.makedirs("output", exist_ok=True)
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Saved results to {filename}")

    async def save_to_database(self):
        """Save enhanced jobs to database with upsert logic"""
        logger.info("Saving enhanced jobs to database with upsert logic")
        
        for job in self.enhanced_jobs:
            try:
                enhanced_data = job.get('enhanced_data', {})
                job_hash = job.get('job_hash')
                
                if not job_hash:
                    logger.warning(f"No job_hash found for job: {job.get('title', 'Unknown')}")
                    continue
                
                # Check if job already exists
                existing_job = await self.check_existing_job(job_hash)
                
                # Prepare job record
                job_record = {
                    'job_hash': job_hash,
                    'title': job.get('title'),
                    'company': job.get('company'),
                    'location': job.get('location'),
                    'salary_low': job.get('salary_low'),
                    'salary_high': job.get('salary_high'),
                    'url': job.get('url'),
                    'job_description': job.get('raw_text', ''),
                    'post_date': datetime.now().strftime('%Y-%m-%d'),
                    'updated_at': datetime.now().isoformat(),
                    # Enhanced fields
                    'company_tier': enhanced_data.get('company_tier', 'SME'),
                    'title_clean': enhanced_data.get('title_clean', job.get('title')),
                    'job_family': enhanced_data.get('job_family', 'Other'),
                    'seniority_level': enhanced_data.get('seniority_level', 'Mid'),
                    'remote_policy': enhanced_data.get('remote_policy', 'Onsite'),
                    'visa_requirement': enhanced_data.get('visa_requirement', {}),
                    'experience_years_req': enhanced_data.get('experience_years_req', {}),
                    'education_req': enhanced_data.get('education_req', []),
                    'certifications_req': enhanced_data.get('certifications_req', []),
                    'skills_required': enhanced_data.get('skills_required', []),
                    'skills_optional': enhanced_data.get('skills_optional', []),
                    'job_functions': enhanced_data.get('job_functions', []),
                    'currency': enhanced_data.get('currency', 'SGD'),
                    'expires_at': enhanced_data.get('expires_at', '2024-12-31'),
                    'trust_score': enhanced_data.get('trust_score', 0.8),
                    'source_site': enhanced_data.get('source_site', 'MyCareersFuture'),
                    'source_url': enhanced_data.get('source_url', ''),
                    'profile_version': '1.0'
                }
                
                if existing_job:
                    # Update existing job
                    logger.info(f"Updating existing job: {job.get('title', 'Unknown')}")
                    result = self.supabase.table('jobs').update(job_record).eq('job_hash', job_hash).execute()
                    job_id = existing_job['id']
                else:
                    # Insert new job
                    logger.info(f"Inserting new job: {job.get('title', 'Unknown')}")
                    job_record['created_at'] = datetime.now().isoformat()
                    result = self.supabase.table('jobs').insert(job_record).execute()
                    job_id = result.data[0]['id'] if result.data else None
                
                if job_id:
                    # Delete existing skills for this job
                    await self.delete_existing_skills(job_id)
                    
                    # Insert required skills
                    required_skills = enhanced_data.get('skills_required', [])
                    if required_skills:
                        skills_data = []
                        for skill in required_skills:
                            skills_data.append({
                                'job_id': job_id,
                                'skill_name': skill.get('name', ''),
                                'skill_level': skill.get('level', 3),
                                'skill_category': self.categorize_skill(skill.get('name', ''))
                            })
                        
                        if skills_data:
                            self.supabase.table('job_skills_required').insert(skills_data).execute()
                    
                    # Insert optional skills
                    optional_skills = enhanced_data.get('skills_optional', [])
                    if optional_skills:
                        skills_data = []
                        for skill in optional_skills:
                            skills_data.append({
                                'job_id': job_id,
                                'skill_name': skill,
                                'skill_category': self.categorize_skill(skill)
                            })
                        
                        if skills_data:
                            self.supabase.table('job_skills_optional').insert(skills_data).execute()
                    
                    self.stats['database_stored'] += 1
                
            except Exception as e:
                logger.warning(f"Failed to save job {job.get('title', 'Unknown')} to database: {e}")
                continue
        
        logger.info(f"✅ Saved/Updated {self.stats['database_stored']} jobs to database")

    async def check_existing_job(self, job_hash: str) -> Optional[Dict]:
        """Check if job already exists in database"""
        try:
            result = self.supabase.table('jobs').select('*').eq('job_hash', job_hash).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.warning(f"Error checking existing job: {e}")
            return None

    async def delete_existing_skills(self, job_id: str):
        """Delete existing skills for a job before inserting new ones"""
        try:
            # Delete required skills
            self.supabase.table('job_skills_required').delete().eq('job_id', job_id).execute()
            # Delete optional skills
            self.supabase.table('job_skills_optional').delete().eq('job_id', job_id).execute()
        except Exception as e:
            logger.warning(f"Error deleting existing skills for job {job_id}: {e}")

    def categorize_skill(self, skill_name: str) -> str:
        """Categorize skill into predefined categories"""
        skill_lower = skill_name.lower()
        
        if any(keyword in skill_lower for keyword in ['python', 'java', 'javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'express']):
            return 'Programming Languages'
        elif any(keyword in skill_lower for keyword in ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform']):
            return 'Cloud & DevOps'
        elif any(keyword in skill_lower for keyword in ['sql', 'mysql', 'postgresql', 'mongodb', 'redis']):
            return 'Database'
        elif any(keyword in skill_lower for keyword in ['machine learning', 'ai', 'tensorflow', 'pytorch', 'pandas', 'numpy']):
            return 'Data Science'
        elif any(keyword in skill_lower for keyword in ['project management', 'agile', 'scrum', 'kanban']):
            return 'Project Management'
        elif any(keyword in skill_lower for keyword in ['sales', 'marketing', 'business development']):
            return 'Business'
        else:
            return 'Other'

    def print_final_report(self):
        """Print final pipeline report"""
        print("\n" + "=" * 60)
        print("🎉 SIMPLIFIED JOB PIPELINE - COMPLETE!")
        print("=" * 60)
        print(f"📊 Raw Jobs Scraped: {self.stats['raw_scraped']}")
        print(f"🤖 Jobs Enhanced: {self.stats['enhanced']}")
        print(f"💾 Jobs Stored in DB: {self.stats['database_stored']}")
        print(f"❌ Jobs Failed: {self.stats['failed']}")
        print("=" * 60)
        
        success_rate = (self.stats['enhanced'] / max(self.stats['raw_scraped'], 1)) * 100
        print(f"📈 Success Rate: {success_rate:.1f}%")
        print("=" * 60)

async def main():
    """Main function"""
    max_pages = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    max_jobs_per_url = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    save_to_db = sys.argv[3].lower() == 'true' if len(sys.argv) > 3 else True
    
    try:
        pipeline = SimplifiedJobPipeline()
        await pipeline.run_pipeline(
            max_pages=max_pages,
            max_jobs_per_url=max_jobs_per_url,
            save_to_database=save_to_db
        )
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
