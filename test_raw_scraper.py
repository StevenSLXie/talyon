#!/usr/bin/env python3
"""
Test script for raw text scraper - runs with only 3 pages for testing
"""

import asyncio
from raw_text_scraper import RawTextScraper

async def test_scraper():
    scraper = RawTextScraper()
    target_url = "https://www.mycareersfuture.gov.sg/search?salary=6000&postingCompany=Direct&sortBy=new_posting_date&page=0"
    
    print("Testing raw text scraper with 3 pages...")
    raw_texts = await scraper.scrape_raw_texts(target_url, max_pages=3)
    
    if raw_texts:
        print(f"Successfully scraped {len(raw_texts)} raw texts")
        print("Sample raw text:")
        print("-" * 50)
        print(raw_texts[0][:500] + "..." if len(raw_texts[0]) > 500 else raw_texts[0])
    else:
        print("No raw texts were scraped")

if __name__ == "__main__":
    asyncio.run(test_scraper())
