#!/usr/bin/env python3
"""
Test Script for Unified Job Pipeline
Runs with 20 jobs limit per URL using the specific URLs from raw_text_scraper.py
"""

import asyncio
import os
from unified_job_pipeline import UnifiedJobPipeline

async def test_pipeline():
    """Test the pipeline with 20 jobs per URL"""
    print("🚀 Testing Unified Job Pipeline")
    print("=" * 50)
    
    # Check environment variables
    required_vars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"❌ Missing environment variables: {missing_vars}")
        print("Please set these in your .env.local file")
        return
    
    # Specific URLs from raw_text_scraper.py
    search_urls = [
        "https://www.mycareersfuture.gov.sg/job/engineering?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0",
        "https://www.mycareersfuture.gov.sg/job/information-technology?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0",
        "https://www.mycareersfuture.gov.sg/job/banking-finance?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0"
    ]
    
    try:
        pipeline = UnifiedJobPipeline()
        
        print(f"📊 URLs to scrape: {len(search_urls)}")
        for i, url in enumerate(search_urls, 1):
            print(f"  {i}. {url}")
        
        print(f"🎯 Parameters:")
        print(f"  - Max pages per URL: 1")
        print(f"  - Batch size: 2")
        print(f"  - No job limit - get all jobs from pages")
        print(f"  - Save to database: True")
        print("=" * 50)
        
        await pipeline.run_complete_pipeline(
            search_urls=search_urls,
            max_pages=1,  # Just 1 page for quick test
            batch_size=2,  # Small batches for testing
            max_jobs_per_url=None,  # No job limit - get all jobs from pages
            save_to_database=True
        )
        
        print("\n🎉 Test completed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(test_pipeline())
