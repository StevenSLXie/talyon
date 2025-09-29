#!/usr/bin/env python3
"""
Usage Examples for Unified Job Pipeline
"""

import asyncio
from unified_job_pipeline import UnifiedJobPipeline

async def example_basic_usage():
    """Basic usage example"""
    print("🚀 Running Basic Job Pipeline Example")
    
    pipeline = UnifiedJobPipeline()
    
    # Run with default settings
    await pipeline.run_complete_pipeline(
        search_url="https://www.mycareersfuture.gov.sg/search?search=software%20engineer&sortBy=relevancy&page=0",
        max_pages=3,  # Small test
        batch_size=2,  # Small batches
        save_to_database=True
    )

async def example_custom_search():
    """Custom search example"""
    print("🔍 Running Custom Search Example")
    
    pipeline = UnifiedJobPipeline()
    
    # Search for data science jobs
    await pipeline.run_complete_pipeline(
        search_url="https://www.mycareersfuture.gov.sg/search?search=data%20scientist&sortBy=relevancy&page=0",
        max_pages=5,
        batch_size=3,
        save_to_database=True
    )

async def example_json_only():
    """JSON-only output example (no database)"""
    print("📄 Running JSON-Only Example")
    
    pipeline = UnifiedJobPipeline()
    
    # Save only to JSON, not database
    await pipeline.run_complete_pipeline(
        search_url="https://www.mycareersfuture.gov.sg/search?search=product%20manager&sortBy=relevancy&page=0",
        max_pages=2,
        batch_size=2,
        save_to_database=False  # JSON only
    )

if __name__ == "__main__":
    print("Unified Job Pipeline - Usage Examples")
    print("=" * 50)
    
    # Run basic example
    asyncio.run(example_basic_usage())
