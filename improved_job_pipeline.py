#!/usr/bin/env python3
"""
Improved Job Pipeline with Enhanced Deduplication
基于unified_job_pipeline.py改进，添加更强的去重机制
"""

import asyncio
import json
import logging
import os
import sys
import hashlib
import re
import pickle
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Set
import openai
from supabase import create_client, Client
from playwright.async_api import async_playwright
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ImprovedJobPipeline:
    def __init__(self):
        # Environment setup
        self.supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
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
        
        # Deduplication sets
        self.existing_job_hashes: Set[str] = set()
        self.existing_urls: Set[str] = set()
        
        # Statistics
        self.stats = {
            'raw_scraped': 0,
            'refined': 0,
            'consolidated': 0,
            'enhanced': 0,
            'database_stored': 0,
            'failed': 0,
            'duplicates_skipped': 0,
            'recent_jobs_skipped': 0
        }
        
        # File paths for intermediate results
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.raw_jobs_file = f"intermediate/raw_jobs_{self.timestamp}.pkl"
        self.refined_jobs_file = f"intermediate/refined_jobs_{self.timestamp}.pkl"
        self.consolidated_jobs_file = f"intermediate/consolidated_jobs_{self.timestamp}.pkl"
        self.enhanced_jobs_file = f"intermediate/enhanced_jobs_{self.timestamp}.pkl"
        self.dedup_data_file = f"intermediate/dedup_data_{self.timestamp}.pkl"
        
        # Create intermediate directory
        os.makedirs("intermediate", exist_ok=True)

    def save_intermediate_data(self, data: Any, filename: str):
        """保存中间结果到文件"""
        try:
            with open(filename, 'wb') as f:
                pickle.dump(data, f)
            logger.info(f"💾 Saved intermediate data to {filename}")
        except Exception as e:
            logger.error(f"❌ Failed to save intermediate data to {filename}: {e}")

    def load_intermediate_data(self, filename: str) -> Optional[Any]:
        """从文件加载中间结果"""
        try:
            if os.path.exists(filename):
                with open(filename, 'rb') as f:
                    data = pickle.load(f)
                logger.info(f"📂 Loaded intermediate data from {filename}")
                return data
            else:
                logger.info(f"📂 No intermediate data found at {filename}")
                return None
        except Exception as e:
            logger.error(f"❌ Failed to load intermediate data from {filename}: {e}")
            return None

    async def load_existing_data(self, days_back: int = 7):
        """加载现有数据用于去重"""
        logger.info(f"🔍 Loading existing job data from last {days_back} days...")
        
        try:
            # 加载最近的工作hash
            cutoff_date = datetime.now() - timedelta(days=days_back)
            recent_jobs = self.supabase.table('jobs').select('job_hash, url, created_at').gte('created_at', cutoff_date.isoformat()).execute()
            
            for job in recent_jobs.data:
                if job.get('job_hash'):
                    self.existing_job_hashes.add(job['job_hash'])
                if job.get('url'):
                    self.existing_urls.add(job['url'])
            
            logger.info(f"✅ Loaded {len(self.existing_job_hashes)} existing job hashes and {len(self.existing_urls)} URLs")
            
            # Save deduplication data
            dedup_data = {
                'existing_job_hashes': self.existing_job_hashes,
                'existing_urls': self.existing_urls,
                'loaded_at': datetime.now().isoformat()
            }
            self.save_intermediate_data(dedup_data, self.dedup_data_file)
            
        except Exception as e:
            logger.warning(f"Failed to load existing data: {e}")

    def generate_enhanced_job_hash(self, job_data: Dict) -> str:
        """生成增强的job hash"""
        # 使用更多字段提高唯一性
        hash_fields = [
            job_data.get('title', ''),
            job_data.get('company', ''),
            job_data.get('location', ''),
            str(job_data.get('salary_low', 0)),
            str(job_data.get('salary_high', 0))
        ]
        
        hash_string = '_'.join(hash_fields)
        return hashlib.md5(hash_string.encode()).hexdigest()

    def is_duplicate_job(self, job: Dict) -> bool:
        """检查是否为重复工作"""
        job_hash = job.get('job_hash')
        job_url = job.get('url')
        
        # 检查hash重复
        if job_hash and job_hash in self.existing_job_hashes:
            return True
        
        # 检查URL重复
        if job_url and job_url in self.existing_urls:
            return True
        
        return False

    async def step1_raw_scraping(self, search_urls: List[str], max_pages: int, max_jobs_per_url: int, start_page: int = 0):
        """Step 1: 抓取原始工作数据，实时去重"""
        logger.info(f"Scraping jobs from {len(search_urls)} URLs")
        logger.info(f"Start page: {start_page}, Max pages per URL: {max_pages}, Max jobs per URL: {max_jobs_per_url}")
        
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
                    
                    await page.goto(search_url, wait_until='networkidle', timeout=30000)
                    await page.wait_for_timeout(5000)
                    
                    current_page = start_page
                    jobs_from_url = 0
                    duplicates_skipped = 0
                    
                    while current_page < start_page + max_pages and (max_jobs_per_url is None or jobs_from_url < max_jobs_per_url):
                        logger.info(f"Scraping page {current_page + 1}/{start_page + max_pages} (Jobs so far: {jobs_from_url}, Duplicates skipped: {duplicates_skipped})")
                        
                        # Navigate to the specific page URL
                        page_url = self.update_page_url(search_url, current_page)
                        if page_url != search_url or current_page > start_page:
                            await page.goto(page_url, wait_until='domcontentloaded', timeout=60000)
                            await page.wait_for_load_state('networkidle', timeout=60000)
                            await page.wait_for_timeout(3000)
                        
                        # Extract job listings from current page
                        jobs = await self.extract_job_listings(page)
                        
                        # 实时去重
                        unique_jobs = []
                        for job in jobs:
                            if not self.is_duplicate_job(job):
                                unique_jobs.append(job)
                                # 添加到去重集合
                                if job.get('job_hash'):
                                    self.existing_job_hashes.add(job['job_hash'])
                                if job.get('url'):
                                    self.existing_urls.add(job['url'])
                            else:
                                duplicates_skipped += 1
                                self.stats['duplicates_skipped'] += 1
                        
                        # Limit jobs per URL only if max_jobs_per_url is specified
                        if max_jobs_per_url is not None and jobs_from_url + len(unique_jobs) > max_jobs_per_url:
                            unique_jobs = unique_jobs[:max_jobs_per_url - jobs_from_url]
                        
                        self.raw_jobs.extend(unique_jobs)
                        jobs_from_url += len(unique_jobs)
                        
                        logger.info(f"Found {len(jobs)} jobs on this page, {len(unique_jobs)} unique (Total from URL: {jobs_from_url})")
                        
                        # Check if we've reached the limit
                        if max_jobs_per_url is not None and jobs_from_url >= max_jobs_per_url:
                            logger.info(f"Reached job limit ({max_jobs_per_url}) for this URL")
                            break
                        
                        current_page += 1
                        await page.wait_for_timeout(3000)
                    
                    logger.info(f"✅ Completed URL {url_index + 1}: {jobs_from_url} jobs, {duplicates_skipped} duplicates skipped")
                    
                    # Small delay between URLs
                    await asyncio.sleep(2)
                
                self.stats['raw_scraped'] = len(self.raw_jobs)
                logger.info(f"✅ Total scraped: {len(self.raw_jobs)} unique job listings")
                logger.info(f"📊 Duplicates skipped: {self.stats['duplicates_skipped']}")
                
                # Save raw jobs data
                self.save_intermediate_data(self.raw_jobs, self.raw_jobs_file)
                
            finally:
                await browser.close()

    def update_page_url(self, base_url: str, page_number: int) -> str:
        """Update the page parameter in the URL"""
        import re
        
        if 'page=' in base_url:
            updated_url = re.sub(r'page=\d+', f'page={page_number}', base_url)
        else:
            separator = '&' if '?' in base_url else '?'
            updated_url = f"{base_url}{separator}page={page_number}"
        
        return updated_url

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
        self.save_intermediate_data(self.refined_jobs, self.refined_jobs_file)

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
        """Step 3: Scrape full job descriptions from individual job pages"""
        logger.info("Scraping full job descriptions from individual job pages")
        
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
                        logger.warning(f"No URL for job {i+1}: {job.get('title', 'Unknown')}")
                        # Add job without description
                        consolidated_job = job.copy()
                        consolidated_job['job_description'] = job.get('raw_text', '')
                        consolidated_job['consolidated_at'] = datetime.now().isoformat()
                        self.consolidated_jobs.append(consolidated_job)
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
                        consolidated_job['job_description'] = job_description if job_description else job.get('raw_text', '')
                        consolidated_job['raw_text'] = await page.text_content('body')
                        consolidated_job['consolidated_at'] = datetime.now().isoformat()
                        
                        self.consolidated_jobs.append(consolidated_job)
                        
                        # Small delay between requests
                        await asyncio.sleep(1)
                        
                    except Exception as e:
                        logger.warning(f"Failed to scrape job {job['title']}: {e}")
                        # Add job without description
                        consolidated_job = job.copy()
                        consolidated_job['job_description'] = job.get('raw_text', '')
                        consolidated_job['consolidated_at'] = datetime.now().isoformat()
                        self.consolidated_jobs.append(consolidated_job)
                        continue
                
                self.stats['consolidated'] = len(self.consolidated_jobs)
                logger.info(f"✅ Consolidated {len(self.consolidated_jobs)} jobs with full descriptions")
                self.save_intermediate_data(self.consolidated_jobs, self.consolidated_jobs_file)
                
            finally:
                await browser.close()

    async def extract_job_description(self, page) -> str:
        """Extract job description from job page"""
        try:
            # Extract job description using multiple selectors
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
                            return description.strip()
                except:
                    continue
            
            # Fallback: get all text content
            return await page.text_content('body')
            
        except Exception as e:
            logger.warning(f"Error extracting job description: {e}")
            return ""

    async def step4_llm_enhancement(self, batch_size: int):
        """Step 4: Enhance jobs with LLM analysis using batch processing"""
        logger.info("Enhancing jobs with LLM analysis using batch processing")
        
        # Process jobs in batches for better efficiency
        for i in range(0, len(self.consolidated_jobs), batch_size):
            batch = self.consolidated_jobs[i:i + batch_size]
            batch_num = i//batch_size + 1
            total_batches = (len(self.consolidated_jobs) + batch_size - 1)//batch_size
            
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} jobs)")
            
            # Process batch with parallel LLM calls
            batch_results = await self.process_batch_with_llm(batch)
            
            # Process results
            for job, enhanced_data in zip(batch, batch_results):
                try:
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
                        
                except Exception as e:
                    logger.warning(f"Failed to process job {job['title']}: {e}")
                    enhanced_job = job.copy()
                    enhanced_job['status'] = 'failed'
                    enhanced_job['error'] = str(e)
                    self.failed_jobs.append(enhanced_job)
            
            # Small delay between batches to avoid rate limiting
            if batch_num < total_batches:
                await asyncio.sleep(1)
        
        self.stats['enhanced'] = len(self.enhanced_jobs)
        self.stats['failed'] = len(self.failed_jobs)
        logger.info(f"✅ Enhanced {len(self.enhanced_jobs)} jobs, {len(self.failed_jobs)} failed")
        self.save_intermediate_data(self.enhanced_jobs, self.enhanced_jobs_file)

    async def process_batch_with_llm(self, batch: List[Dict]) -> List[Optional[Dict]]:
        """Process a batch of jobs with parallel LLM calls"""
        tasks = []
        
        for job in batch:
            task = asyncio.create_task(self.enhance_job_with_llm_async(job))
            tasks.append(task)
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(f"LLM call failed for job {batch[i]['title']}: {result}")
                processed_results.append(None)
            else:
                processed_results.append(result)
        
        return processed_results

    async def enhance_job_with_llm_async(self, job: Dict) -> Optional[Dict]:
        """Async wrapper for LLM enhancement"""
        try:
            prompt = self.build_enhancement_prompt(job)
            
            # Run LLM call in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "You are an expert job analyst specializing in the Singapore job market. Extract structured data from job descriptions and return valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1
                )
            )
            
            enhanced_data = json.loads(response.choices[0].message.content)
            return enhanced_data
            
        except Exception as e:
            logger.warning(f"LLM enhancement failed for {job.get('title', 'Unknown')}: {e}")
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
            "leadership_level": "IC|Team Lead|Team Lead++",
            "management_required": false,
            "team_size_mentioned": "1-5|6-10|10+|Not specified",
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
        - Leadership level: IC (Individual Contributor), Team Lead (manages 1-5 people), Team Lead++ (manages 6+ people, senior management)
        - Management required: true if job requires managing people, false for individual contributor roles
        - Team size mentioned: Extract team size from job description (e.g., "manage team of 5", "lead 10+ engineers")
        """

    async def save_jobs_to_database(self):
        """保存工作数据到数据库 - 使用 upsert 逻辑，不清空现有数据"""
        logger.info(f"💾 Saving {len(self.enhanced_jobs)} jobs to database with upsert logic...")
        
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
                    'industry': job.get('industry'),
                    'job_type': job.get('job_type'),
                    'experience_level': job.get('experience_level'),
                    'url': job.get('url'),
                    'job_description': job.get('job_description'),
                    'post_date': job.get('post_date'),
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
                    'leadership_level': enhanced_data.get('leadership_level', 'IC'),
                    'management_required': enhanced_data.get('management_required', False),
                    'team_size_mentioned': enhanced_data.get('team_size_mentioned', 'Not specified'),
                    'currency': enhanced_data.get('currency', 'SGD'),
                    'expires_at': enhanced_data.get('expires_at', '2024-12-31'),
                    'trust_score': enhanced_data.get('trust_score', 0.8),
                    'source_site': enhanced_data.get('source_site', 'MyCareersFuture'),
                    'source_url': enhanced_data.get('source_url', ''),
                    'profile_version': 1
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

    async def extract_job_listings(self, page) -> List[Dict]:
        """Extract job listings from current page"""
        jobs = []
        
        try:
            # Try different selectors to find job card containers
            selectors_to_try = [
                'div[data-testid*="job-card"]',
                'div[data-testid*="job"]',
                'article[data-testid*="job"]',
                'div[class*="job"]',
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
                    
                    # Parse the raw text to extract structured data
                    job_data = self.parse_job_text(raw_text)
                    
                    if not job_data.get('title') or not job_data.get('company'):
                        continue
                    
                    # Generate enhanced job hash
                    job_hash = self.generate_enhanced_job_hash(job_data)
                    
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
        job_data = {}
        
        # Clean the raw text and split into lines
        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        
        # Skip job separators like "=== JOB X ==="
        filtered_lines = []
        for line in lines:
            if not line.startswith('===') and not line.endswith('==='):
                filtered_lines.append(line)
        
        if not filtered_lines:
            return job_data
        
        # Extract company (usually first line)
        job_data['company'] = filtered_lines[0]
        
        # Extract title (usually second line, skip if it's a response time indicator)
        title_candidates = []
        for i, line in enumerate(filtered_lines[1:6]):  # Check first few lines after company
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
            job_data['title'] = filtered_lines[1] if len(filtered_lines) > 1 else "Unknown"
        
        # Extract location (look for location patterns)
        location_patterns = [
            r'(Islandwide|Central|North|South|East|West)',
            r'(Singapore|SG)',
            r'(Remote|Hybrid)'
        ]
        
        for line in filtered_lines:
            for pattern in location_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    job_data['location'] = match.group(1)
                    break
            if 'location' in job_data:
                break
        
        # If no location found, try to extract from common patterns
        if 'location' not in job_data:
            for line in filtered_lines:
                if any(keyword in line.lower() for keyword in ['singapore', 'central', 'east', 'west', 'north', 'south', 'islandwide']):
                    job_data['location'] = line
                    break
        
        # Look for salary in any line
        for line in filtered_lines:
            if '$' in line and ('to' in line or '-' in line or 'salary' in line.lower()):
                job_data['salary_text'] = line
                salary_low, salary_high = self.parse_salary(line)
                job_data['salary_low'] = salary_low
                job_data['salary_high'] = salary_high
                break
        
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

    async def run_improved_pipeline(self, 
                                  search_urls: List[str] = None,
                                  max_pages: int = 10,
                                  batch_size: int = 5,
                                  save_to_database: bool = True,
                                  max_jobs_per_url: int = None,
                                  days_back: int = 7,
                                  start_page: int = 0):
        """
        运行改进的工作管道
        
        Args:
            search_urls: 搜索URL列表
            max_pages: 每个URL最大页数
            batch_size: LLM处理批次大小
            save_to_database: 是否保存到数据库
            max_jobs_per_url: 每个URL最大工作数
            days_back: 检查重复的天数
            start_page: 起始页数
        """
        logger.info("🚀 Starting Improved Job Pipeline")
        logger.info("=" * 60)
        
        # Default URLs
        if search_urls is None:
            search_urls = [
                "https://www.mycareersfuture.gov.sg/job/engineering?salary=12000&postingCompany=Direct&sortBy=new_posting_date&page=0",
                "https://www.mycareersfuture.gov.sg/job/information-technology?salary=12000&postingCompany=Direct&sortBy=new_posting_date&page=0",
                "https://www.mycareersfuture.gov.sg/job/banking-finance?salary=12000&postingCompany=Direct&sortBy=new_posting_date&page=0"
            ]
        
        try:
            # Step 0: Load existing data for deduplication
            await self.load_existing_data(days_back)
            
            # Step 1: Raw Scraping with real-time deduplication
            logger.info("📊 Step 1: Raw Job Scraping with Deduplication")
            
            # Check if we can resume from intermediate data
            raw_jobs_data = self.load_intermediate_data(self.raw_jobs_file)
            if raw_jobs_data is not None:
                logger.info(f"🔄 Resuming from intermediate data: {len(raw_jobs_data)} raw jobs")
                self.raw_jobs = raw_jobs_data
                self.stats['raw_scraped'] = len(self.raw_jobs)
            else:
                await self.step1_raw_scraping(search_urls, max_pages, max_jobs_per_url, start_page)
            
            # Step 2: Data Refinement
            logger.info("🔧 Step 2: Data Refinement & Deduplication")
            await self.step2_data_refinement()
            
            # Step 3: Job Consolidation (Full Details)
            logger.info("📋 Step 3: Job Consolidation (Full Details)")
            await self.step3_job_consolidation()
            
            # Step 4: LLM Enhancement
            logger.info("🤖 Step 4: LLM Enhancement")
            await self.step4_llm_enhancement(batch_size)
            
            # Step 5: Save to Database
            if save_to_database:
                logger.info("💾 Step 5: Saving to Database")
                await self.save_jobs_to_database()
            
            # Final Report
            self.print_final_report()
            
        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            logger.info("💾 Intermediate data has been saved. You can resume from the last successful step.")
            raise

    def print_final_report(self):
        """Print final pipeline report"""
        print("\n" + "=" * 60)
        print("🎉 IMPROVED JOB PIPELINE - COMPLETE!")
        print("=" * 60)
        print(f"📊 Raw Jobs Scraped: {self.stats['raw_scraped']}")
        print(f"🔧 Jobs Refined: {self.stats['refined']}")
        print(f"📋 Jobs Consolidated: {self.stats['consolidated']}")
        print(f"🤖 Jobs Enhanced: {self.stats['enhanced']}")
        print(f"💾 Jobs Stored in DB: {self.stats['database_stored']}")
        print(f"❌ Jobs Failed: {self.stats['failed']}")
        print(f"🔄 Duplicates Skipped: {self.stats['duplicates_skipped']}")
        print("=" * 60)
        
        if self.stats['raw_scraped'] > 0:
            duplicate_rate = (self.stats['duplicates_skipped'] / (self.stats['raw_scraped'] + self.stats['duplicates_skipped'])) * 100
            print(f"📈 Duplicate Rate: {duplicate_rate:.1f}%")
        
        if self.stats['enhanced'] > 0:
            success_rate = (self.stats['enhanced'] / max(self.stats['raw_scraped'], 1)) * 100
            print(f"📈 Success Rate: {success_rate:.1f}%")
        print("=" * 60)

async def main():
    """Main function"""
    # Use the specific URLs
    search_urls = [
        "https://www.mycareersfuture.gov.sg/job/engineering?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0",
        "https://www.mycareersfuture.gov.sg/job/information-technology?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0",
        "https://www.mycareersfuture.gov.sg/job/banking-finance?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0",
        "https://www.mycareersfuture.gov.sg/job/sciences?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0"
    ]
    
    # Parameters
    max_pages = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    batch_size = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    max_jobs_per_url = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] != 'None' else None
    days_back = int(sys.argv[4]) if len(sys.argv) > 4 else 7
    start_page = int(sys.argv[5]) if len(sys.argv) > 5 else 0
    
    try:
        pipeline = ImprovedJobPipeline()
        await pipeline.run_improved_pipeline(
            search_urls=search_urls,
            max_pages=max_pages,
            batch_size=batch_size,
            max_jobs_per_url=max_jobs_per_url,
            days_back=days_back,
            start_page=start_page
        )
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
