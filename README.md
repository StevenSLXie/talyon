# MyCareersFuture.sg Job Scraper

A robust Python web scraper built with Playwright that successfully extracts job listings from MyCareersFuture.sg search results, handling the React-based Single Page Application architecture.

## ✅ Successfully Working Solution

This scraper successfully extracts job data from MyCareersFuture.sg by:
- **Handling React SPA**: Waits for JavaScript to load and render content
- **Using Firefox**: Firefox works reliably where Chrome fails
- **Multiple Extraction Strategies**: Falls back to different methods if one fails
- **Structured Data Parsing**: Intelligently parses job information from text content

## Features

- 🚀 **React-Aware**: Handles JavaScript-rendered content and React application lifecycle
- 📊 **Structured Data**: Extracts company name, job title, salary, location, job type, and posting date
- 💾 **Multiple Formats**: Saves data in both JSON and CSV formats
- 🔄 **Pagination Support**: Automatically scrapes multiple pages
- 📝 **Detailed Logging**: Comprehensive logging for monitoring and debugging
- 🛡️ **Robust Error Handling**: Multiple fallback strategies for reliable data extraction

## Extracted Data Fields

- **Company**: Company name
- **Title**: Job title/position
- **Salary**: Salary range (e.g., "$6,500to$7,500")
- **Location**: Job location (e.g., "East", "Central", "Singapore")
- **Job Type**: Employment type (Full Time, Part Time, Contract, etc.)
- **Posted Date**: When the job was posted (e.g., "Posted today")
- **Job URL**: Direct link to the job posting
- **Scraped At**: Timestamp when data was extracted

## Quick Start

### 1. Setup Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install firefox
```

### 2. Run the Scraper

```bash
python final_scraper.py
```

### 3. View Results

The scraper will create timestamped files:
- `mycareersfuture_jobs_YYYYMMDD_HHMMSS.json`
- `mycareersfuture_jobs_YYYYMMDD_HHMMSS.csv`

## Example Output

```
2025-09-16 22:43:46,040 - INFO - Job 1:
2025-09-16 22:43:46,040 - INFO -   Company: CODYX SERVICES PTE. LTD.
2025-09-16 22:43:46,040 - INFO -   Title: Visual Communication Designer
2025-09-16 22:43:46,040 - INFO -   Location: East
2025-09-16 22:43:46,040 - INFO -   Job Type: Full Time
2025-09-16 22:43:46,040 - INFO -   Salary: $6,500to$7,500
2025-09-16 22:43:46,040 - INFO -   Posted: Posted today
2025-09-16 22:43:46,040 - INFO -   URL: https://www.mycareersfuture.gov.sg/job/design/visual-communication-designer-codyx-services-001159b46a4ec5f1716967059ac4abf8?source=MCF&event=Search
```

## Configuration

You can modify the scraper behavior by editing `final_scraper.py`:

- **Target URL**: Change the `target_url` variable in the `main()` function
- **Max Pages**: Adjust `max_pages` parameter (default: 3)
- **Headless Mode**: Set `headless=True` in browser launch for production

## Example Usage

```python
from final_scraper import MyCareersFutureScraper
import asyncio

async def custom_scrape():
    scraper = MyCareersFutureScraper()
    
    # Custom URL with different filters
    url = "https://www.mycareersfuture.gov.sg/search?salary=8000&postingCompany=Direct&sortBy=new_posting_date&page=0"
    
    # Scrape up to 5 pages
    jobs = await scraper.scrape_jobs(url, max_pages=5)
    
    # Save and view results
    scraper.save_to_csv("custom_jobs.csv")
    scraper.print_summary()

# Run custom scraper
asyncio.run(custom_scrape())
```

## Requirements

- Python 3.7+
- Playwright
- pandas

## Why This Solution Works

### The Challenge
MyCareersFuture.sg is a React-based Single Page Application (SPA) that:
- Loads job data dynamically via JavaScript
- Shows only a loading spinner in the initial HTML
- Requires full browser automation to execute JavaScript
- Has anti-bot protection measures

### The Solution
Our scraper successfully handles this by:
1. **Using Firefox**: Firefox works reliably where Chrome fails due to compatibility issues
2. **Waiting for React**: Waits for the React application to fully initialize
3. **Smart Text Parsing**: Intelligently parses job information from the rendered text content
4. **Robust Error Handling**: Multiple fallback strategies ensure reliable data extraction

## Technical Details

- **Browser**: Firefox (headless mode)
- **Wait Strategy**: `networkidle` + custom React detection
- **Data Extraction**: CSS selectors + intelligent text parsing
- **Pagination**: Automatic next page detection and navigation
- **Rate Limiting**: 2-second delays between page requests

## Troubleshooting

### Common Issues

1. **Firefox Installation**: If Firefox fails to install, run:
   ```bash
   playwright install firefox
   ```

2. **Network Timeouts**: Increase timeout values in the script if the website is slow

3. **No Jobs Found**: The website structure might have changed. Check the selectors in `extract_jobs_from_page()` method

### Debug Mode

Set `headless=False` in the browser launch to see the browser in action and debug any issues.

## Legal Notice

This scraper is for educational and research purposes. Please respect the website's terms of service and robots.txt file. The scraper includes appropriate delays between requests to be respectful to the server.

## Success Metrics

✅ **Successfully extracts job data from MyCareersFuture.sg**  
✅ **Handles React SPA architecture**  
✅ **Extracts structured job information**  
✅ **Supports pagination**  
✅ **Saves data in multiple formats**  
✅ **Robust error handling**

