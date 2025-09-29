#!/usr/bin/env python3
"""
Unified Job Pipeline Script
Complete pipeline: Crawl → Refine → Consolidate → Enhance → Store (JSON + Database)
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

class UnifiedJobPipeline:
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
        self.refined_jobs = []
        self.consolidated_jobs = []
        self.enhanced_jobs = []
        self.failed_jobs = []
        
        # Statistics
        self.stats = {
            'raw_scraped': 0,
            'refined': 0,
            'consolidated': 0,
            'enhanced': 0,
            'database_stored': 0,
            'failed': 0
        }

    async def run_complete_pipeline(self, 
                                  search_url: str = "https://www.mycareersfuture.gov.sg/search?search=software%20engineer&sortBy=relevancy&page=0",
                                  max_pages: int = 10,
                                  batch_size: int = 5,
                                  save_to_database: bool = True):
        """
        Run the complete job pipeline
        
        Args:
            search_url: MyCareersFuture search URL
            max_pages: Maximum pages to scrape
            batch_size: Batch size for LLM processing
            save_to_database: Whether to save to database
        """
        logger.info("🚀 Starting Unified Job Pipeline")
        logger.info("=" * 60)
        
        try:
            # Step 1: Raw Scraping
            logger.info("📊 Step 1: Raw Job Scraping")
            await self.step1_raw_scraping(search_url, max_pages)
            
            # Step 2: Data Refinement
            logger.info("🔧 Step 2: Data Refinement & Deduplication")
            await self.step2_data_refinement()
            
            # Step 3: Job Consolidation (Full Details)
            logger.info("📋 Step 3: Job Consolidation (Full Details)")
            await self.step3_job_consolidation()
            
            # Step 4: LLM Enhancement
            logger.info("🤖 Step 4: LLM Enhancement")
            await self.step4_llm_enhancement(batch_size)
            
            # Step 5: Storage (JSON + Database)
            logger.info("💾 Step 5: Storage (JSON + Database)")
            await self.step5_storage(save_to_database)
            
            # Final Report
            self.print_final_report()
            
        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            raise

    async def step1_raw_scraping(self, search_url: str, max_pages: int):
        """Step 1: Scrape raw job listings"""
        logger.info(f"Scraping jobs from: {search_url}")
        logger.info(f"Max pages: {max_pages}")
        
        async with async_playwright() as p:
            browser = await p.firefox.launch(headless=True)
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0'
            )
            page = await context.new_page()
            
            try:
                await page.goto(search_url, wait_until='networkidle', timeout=30000)
                await page.wait_for_timeout(3000)
                
                current_page = 0
                while current_page < max_pages:
                    logger.info(f"Scraping page {current_page + 1}/{max_pages}")
                    
                    # Extract job listings from current page
                    jobs = await self.extract_job_listings(page)
                    self.raw_jobs.extend(jobs)
                    
                    # Navigate to next page
                    next_button = page.locator('button[aria-label="Next page"]')
                    if await next_button.count() > 0 and await next_button.is_enabled():
                        await next_button.click()
                        await page.wait_for_timeout(3000)
                        current_page += 1
                    else:
                        logger.info("No more pages available")
                        break
                
                self.stats['raw_scraped'] = len(self.raw_jobs)
                logger.info(f"✅ Scraped {len(self.raw_jobs)} raw job listings")
                
            finally:
                await browser.close()

    async def extract_job_listings(self, page) -> List[Dict]:
        """Extract job listings from current page"""
        jobs = []
        
        # Wait for job cards to load
        await page.wait_for_selector('[data-testid="job-card"]', timeout=10000)
        
        # Extract job cards
        job_cards = await page.locator('[data-testid="job-card"]').all()
        
        for card in job_cards:
            try:
                job_data = await self.extract_single_job_card(card)
                if job_data:
                    jobs.append(job_data)
            except Exception as e:
                logger.warning(f"Failed to extract job card: {e}")
                continue
        
        return jobs

    async def extract_single_job_card(self, card) -> Optional[Dict]:
        """Extract data from a single job card"""
        try:
            # Extract basic job information
            title_element = card.locator('h3 a')
            title = await title_element.text_content()
            url = await title_element.get_attribute('href')
            
            company_element = card.locator('[data-testid="company-name"]')
            company = await company_element.text_content()
            
            location_element = card.locator('[data-testid="job-location"]')
            location = await location_element.text_content()
            
            salary_element = card.locator('[data-testid="job-salary"]')
            salary_text = await salary_element.text_content()
            
            # Parse salary
            salary_low, salary_high = self.parse_salary(salary_text)
            
            # Generate job hash for deduplication
            job_hash = hashlib.md5(f"{title}_{company}_{location}".encode()).hexdigest()
            
            return {
                'title': title.strip() if title else '',
                'company': company.strip() if company else '',
                'location': location.strip() if location else '',
                'salary_text': salary_text.strip() if salary_text else '',
                'salary_low': salary_low,
                'salary_high': salary_high,
                'url': url,
                'job_hash': job_hash,
                'scraped_at': datetime.now().isoformat(),
                'source': 'mycareersfuture'
            }
            
        except Exception as e:
            logger.warning(f"Error extracting job card: {e}")
            return None

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

    async def step2_data_refinement(self):
        """Step 2: Refine and deduplicate job data"""
        logger.info("Refining and deduplicating job data")
        
        # Remove duplicates based on job_hash
        seen_hashes = set()
        unique_jobs = []
        
        for job in self.raw_jobs:
            job_hash = job.get('job_hash')
            if job_hash and job_hash not in seen_hashes:
                seen_hashes.add(job_hash)
                
                # Clean and validate job data
                refined_job = self.refine_single_job(job)
                if refined_job:
                    unique_jobs.append(refined_job)
        
        self.refined_jobs = unique_jobs
        self.stats['refined'] = len(self.refined_jobs)
        logger.info(f"✅ Refined to {len(self.refined_jobs)} unique jobs")

    def refine_single_job(self, job: Dict) -> Optional[Dict]:
        """Refine a single job entry"""
        try:
            # Basic validation
            if not job.get('title') or not job.get('company'):
                return None
            
            # Clean text fields
            refined_job = {
                'title': job['title'].strip(),
                'company': job['company'].strip(),
                'location': job.get('location', '').strip(),
                'salary_low': job.get('salary_low', 0),
                'salary_high': job.get('salary_high', 0),
                'url': job.get('url', ''),
                'job_hash': job.get('job_hash', ''),
                'scraped_at': job.get('scraped_at', datetime.now().isoformat()),
                'source': job.get('source', 'mycareersfuture'),
                'industry': self.infer_industry(job['title']),
                'job_type': 'Full Time',  # Default assumption
                'experience_level': self.infer_experience_level(job['title']),
                'post_date': datetime.now().strftime('%Y-%m-%d')
            }
            
            return refined_job
            
        except Exception as e:
            logger.warning(f"Error refining job: {e}")
            return None

    def infer_industry(self, title: str) -> str:
        """Infer industry from job title"""
        title_lower = title.lower()
        
        if any(keyword in title_lower for keyword in ['software', 'developer', 'engineer', 'programmer', 'tech']):
            return 'Information Technology'
        elif any(keyword in title_lower for keyword in ['finance', 'banking', 'accounting', 'financial']):
            return 'Banking & Finance'
        elif any(keyword in title_lower for keyword in ['marketing', 'sales', 'business development']):
            return 'Marketing & Sales'
        elif any(keyword in title_lower for keyword in ['healthcare', 'medical', 'nurse', 'doctor']):
            return 'Healthcare'
        else:
            return 'Other'

    def infer_experience_level(self, title: str) -> str:
        """Infer experience level from job title"""
        title_lower = title.lower()
        
        if any(keyword in title_lower for keyword in ['senior', 'lead', 'principal', 'architect']):
            return 'Senior'
        elif any(keyword in title_lower for keyword in ['junior', 'entry', 'graduate', 'trainee']):
            return 'Entry'
        elif any(keyword in title_lower for keyword in ['manager', 'director', 'head', 'chief']):
            return 'Management'
        else:
            return 'Mid'

    async def step3_job_consolidation(self):
        """Step 3: Scrape full job descriptions"""
        logger.info("Scraping full job descriptions")
        
        async with async_playwright() as p:
            browser = await p.firefox.launch(headless=True)
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0'
            )
            page = await context.new_page()
            
            try:
                for i, job in enumerate(self.refined_jobs):
                    if not job.get('url'):
                        continue
                    
                    logger.info(f"Scraping job {i+1}/{len(self.refined_jobs)}: {job['title']}")
                    
                    try:
                        # Navigate to job page
                        await page.goto(job['url'], wait_until='networkidle', timeout=30000)
                        await page.wait_for_timeout(2000)
                        
                        # Extract full job description
                        job_description = await self.extract_job_description(page)
                        
                        # Update job with full description
                        consolidated_job = job.copy()
                        consolidated_job['job_description'] = job_description
                        consolidated_job['raw_text'] = await page.text_content('body')
                        consolidated_job['consolidated_at'] = datetime.now().isoformat()
                        
                        self.consolidated_jobs.append(consolidated_job)
                        
                        # Small delay between requests
                        await asyncio.sleep(1)
                        
                    except Exception as e:
                        logger.warning(f"Failed to scrape job {job['title']}: {e}")
                        # Add job without description
                        self.consolidated_jobs.append(job)
                        continue
                
                self.stats['consolidated'] = len(self.consolidated_jobs)
                logger.info(f"✅ Consolidated {len(self.consolidated_jobs)} jobs with full descriptions")
                
            finally:
                await browser.close()

    async def extract_job_description(self, page) -> str:
        """Extract job description from job page"""
        try:
            # Try different selectors for job description
            selectors = [
                '[data-testid="job-description"]',
                '.job-description',
                '[class*="description"]',
                'main'
            ]
            
            for selector in selectors:
                try:
                    element = page.locator(selector)
                    if await element.count() > 0:
                        text = await element.text_content()
                        if text and len(text.strip()) > 100:  # Ensure we got meaningful content
                            return text.strip()
                except:
                    continue
            
            # Fallback: get all text content
            return await page.text_content('body')
            
        except Exception as e:
            logger.warning(f"Error extracting job description: {e}")
            return ""

    async def step4_llm_enhancement(self, batch_size: int):
        """Step 4: Enhance jobs with LLM analysis"""
        logger.info("Enhancing jobs with LLM analysis")
        
        for i in range(0, len(self.consolidated_jobs), batch_size):
            batch = self.consolidated_jobs[i:i + batch_size]
            logger.info(f"Processing batch {i//batch_size + 1}/{(len(self.consolidated_jobs) + batch_size - 1)//batch_size}")
            
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
        Industry: {job.get('industry', '')}
        
        Job Description:
        {job.get('job_description', '')[:2000]}
        
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

    async def step5_storage(self, save_to_database: bool):
        """Step 5: Save to JSON and optionally to database"""
        logger.info("Saving results to JSON and database")
        
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
                "total_refined": self.stats['refined'],
                "total_consolidated": self.stats['consolidated'],
                "total_enhanced": self.stats['enhanced'],
                "total_failed": self.stats['failed'],
                "description": "Complete job pipeline results with LLM enhancement"
            },
            "enhanced_jobs": self.enhanced_jobs,
            "failed_jobs": self.failed_jobs
        }
        
        filename = f"output/unified_pipeline_{timestamp}.json"
        os.makedirs("output", exist_ok=True)
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Saved results to {filename}")

    async def save_to_database(self):
        """Save enhanced jobs to database"""
        logger.info("Saving enhanced jobs to database")
        
        for job in self.enhanced_jobs:
            try:
                enhanced_data = job.get('enhanced_data', {})
                
                # Prepare job record
                job_record = {
                    'job_hash': job.get('job_hash'),
                    'title': job.get('title'),
                    'company': job.get('company'),
                    'location': job.get('location'),
                    'salary_low': job.get('salary_low'),
                    'salary_high': job.get('salary_high'),
                    'industry': job.get('industry'),
                    'job_type': job.get('job_type'),
                    'experience_level': job.get('experience_level'),
                    'url': job.get('url'),
                    'job_description': job.get('job_description'),
                    'post_date': job.get('post_date'),
                    'created_at': datetime.now().isoformat(),
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
                
                # Insert job record
                result = self.supabase.table('jobs').insert(job_record).execute()
                
                if result.data:
                    job_id = result.data[0]['id']
                    
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
        
        logger.info(f"✅ Saved {self.stats['database_stored']} jobs to database")

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
        print("🎉 UNIFIED JOB PIPELINE - COMPLETE!")
        print("=" * 60)
        print(f"📊 Raw Jobs Scraped: {self.stats['raw_scraped']}")
        print(f"🔧 Jobs Refined: {self.stats['refined']}")
        print(f"📋 Jobs Consolidated: {self.stats['consolidated']}")
        print(f"🤖 Jobs Enhanced: {self.stats['enhanced']}")
        print(f"💾 Jobs Stored in DB: {self.stats['database_stored']}")
        print(f"❌ Jobs Failed: {self.stats['failed']}")
        print("=" * 60)
        
        success_rate = (self.stats['enhanced'] / max(self.stats['raw_scraped'], 1)) * 100
        print(f"📈 Success Rate: {success_rate:.1f}%")
        print("=" * 60)

async def main():
    """Main function"""
    if len(sys.argv) > 1:
        search_url = sys.argv[1]
    else:
        search_url = "https://www.mycareersfuture.gov.sg/search?search=software%20engineer&sortBy=relevancy&page=0"
    
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    batch_size = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    save_to_db = sys.argv[4].lower() == 'true' if len(sys.argv) > 4 else True
    
    try:
        pipeline = UnifiedJobPipeline()
        await pipeline.run_complete_pipeline(
            search_url=search_url,
            max_pages=max_pages,
            batch_size=batch_size,
            save_to_database=save_to_db
        )
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
