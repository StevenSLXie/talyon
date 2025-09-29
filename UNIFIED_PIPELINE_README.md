# Unified Job Pipeline

## Overview

The Unified Job Pipeline combines all job processing steps into a single, streamlined script:

**Crawl → Refine → Consolidate → Enhance → Store (JSON + Database)**

## How Each Step Works

### 🔍 **Step 1: Raw Scraping (`raw_text_scraper.py` logic)**
- **Input**: MyCareersFuture search URL
- **Process**: Uses Playwright to scrape job listings from search pages
- **Output**: Raw job data with basic fields (title, company, location, salary, URL)
- **Features**: Handles pagination, extracts job cards, generates job_hash for deduplication

### 🔧 **Step 2: Data Refinement (`data_refiner.py` logic)**
- **Input**: Raw scraped jobs
- **Process**: Removes duplicates, cleans data, validates fields, infers missing data
- **Output**: Cleaned, unique job entries
- **Features**: Deduplication by job_hash, industry inference, experience level detection

### 📋 **Step 3: Job Consolidation (`consolidate_jobs.py` logic)**
- **Input**: Refined jobs with URLs
- **Process**: Scrapes individual job pages for full descriptions
- **Output**: Jobs with complete job descriptions and raw text
- **Features**: Full job detail extraction, error handling, rate limiting

### 🤖 **Step 4: LLM Enhancement (`enhance_jobs.py` logic)**
- **Input**: Consolidated jobs with full descriptions
- **Process**: Uses OpenAI GPT-4o-mini to extract structured data
- **Output**: Enhanced jobs with structured profiles
- **Features**: Company tier classification, skills extraction, requirements parsing

### 💾 **Step 5: Storage**
- **JSON Output**: Saves complete results to timestamped JSON file
- **Database Storage**: Inserts enhanced jobs into Supabase database
- **Features**: Uses job_hash as unique identifier, structured skills storage

## Usage

### Command Line
```bash
# Basic usage
python unified_job_pipeline.py

# Custom search URL
python unified_job_pipeline.py "https://www.mycareersfuture.gov.sg/search?search=data%20scientist&sortBy=relevancy&page=0"

# Custom parameters
python unified_job_pipeline.py "search_url" 5 3 true
# Parameters: search_url, max_pages, batch_size, save_to_database
```

### Python Script
```python
import asyncio
from unified_job_pipeline import UnifiedJobPipeline

async def run_pipeline():
    pipeline = UnifiedJobPipeline()
    
    await pipeline.run_complete_pipeline(
        search_url="https://www.mycareersfuture.gov.sg/search?search=software%20engineer&sortBy=relevancy&page=0",
        max_pages=5,
        batch_size=3,
        save_to_database=True
    )

asyncio.run(run_pipeline())
```

## Output Files

### JSON Output
- **File**: `output/unified_pipeline_YYYYMMDD_HHMMSS.json`
- **Structure**:
```json
{
  "metadata": {
    "generated_at": "2025-09-29T22:30:00",
    "pipeline_version": "1.0",
    "total_raw": 50,
    "total_refined": 45,
    "total_consolidated": 40,
    "total_enhanced": 38,
    "total_failed": 2
  },
  "enhanced_jobs": [
    {
      "title": "Software Engineer",
      "company": "Tech Corp",
      "job_hash": "abc123...",
      "enhanced_data": {
        "company_tier": "MNC",
        "skills_required": [
          {"name": "Python", "level": 4},
          {"name": "React", "level": 3}
        ],
        "experience_years_req": {"min": 3, "max": 5}
      }
    }
  ],
  "failed_jobs": [...]
}
```

### Database Storage
- **Jobs Table**: Enhanced job records with structured data
- **Job Skills Tables**: Separate tables for required/optional skills
- **Uses job_hash**: As unique identifier for deduplication

## Key Features

### ✅ **Unified Processing**
- Single script handles entire pipeline
- Consistent error handling and logging
- Progress tracking and statistics

### ✅ **Flexible Configuration**
- Customizable search URLs
- Adjustable batch sizes and page limits
- Optional database storage

### ✅ **Robust Error Handling**
- Continues processing on individual failures
- Detailed error logging
- Failed jobs tracked separately

### ✅ **Deduplication**
- Uses job_hash for unique identification
- Prevents duplicate processing
- Maintains data integrity

### ✅ **Rate Limiting**
- Respects website rate limits
- Configurable delays between requests
- Batch processing for LLM calls

## Environment Setup

```bash
# Required environment variables
export SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_ROLE_KEY=your_service_key
export OPENAI_API_KEY=your_openai_key

# Install dependencies
pip install playwright openai supabase python-dotenv
playwright install firefox
```

## Pipeline Statistics

The pipeline tracks and reports:
- **Raw Jobs Scraped**: Initial job listings found
- **Jobs Refined**: After deduplication and cleaning
- **Jobs Consolidated**: With full descriptions
- **Jobs Enhanced**: Successfully processed by LLM
- **Jobs Stored**: Saved to database
- **Jobs Failed**: Processing failures

## Error Handling

- **Scraping Errors**: Continues with next job
- **LLM Errors**: Logs failure, continues processing
- **Database Errors**: Logs failure, continues with next job
- **Network Errors**: Retries with delays

## Performance Considerations

- **Batch Processing**: LLM calls processed in batches
- **Rate Limiting**: Delays between requests
- **Memory Management**: Processes jobs in chunks
- **Error Recovery**: Continues processing on failures

## Migration from Separate Scripts

The unified pipeline replaces these separate scripts:
- ✅ `raw_text_scraper.py` → Step 1
- ✅ `data_refiner.py` → Step 2  
- ✅ `consolidate_jobs.py` → Step 3
- ✅ `enhance_jobs.py` → Step 4
- ✅ Database storage → Step 5

**Benefits of Unified Approach**:
- Single point of control
- Consistent error handling
- Better progress tracking
- Simplified deployment
- Reduced maintenance overhead
