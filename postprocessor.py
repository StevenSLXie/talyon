#!/usr/bin/env python3
"""
Postprocessing script for recruiter job data.
Merges CSV files, removes duplicates, and generates company analytics with LLM-powered insights.
"""

import pandas as pd
import os
import glob
import json
import logging
from datetime import datetime
from typing import List, Dict, Any
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def merge_csv_files(output_dir: str = "output") -> pd.DataFrame:
    """
    Merge all CSV files from the output directory (excluding previous analysis files).
    
    Args:
        output_dir: Directory containing CSV files
        
    Returns:
        Merged DataFrame with all job data
    """
    csv_files = glob.glob(os.path.join(output_dir, "*.csv"))
    
    # Filter out previous analysis files
    job_csv_files = [f for f in csv_files if not any(x in os.path.basename(f) for x in ['unique_jobs_', 'top_companies_', 'postprocessing_summary_'])]
    
    if not job_csv_files:
        raise ValueError(f"No job CSV files found in {output_dir}")
    
    print(f"Found {len(job_csv_files)} job CSV files to merge:")
    for file in job_csv_files:
        print(f"  - {os.path.basename(file)}")
    
    # Read and concatenate all CSV files
    dataframes = []
    for file in job_csv_files:
        try:
            df = pd.read_csv(file)
            print(f"  Loaded {len(df)} records from {os.path.basename(file)}")
            dataframes.append(df)
        except Exception as e:
            print(f"  Error reading {file}: {e}")
    
    if not dataframes:
        raise ValueError("No valid CSV files could be read")
    
    merged_df = pd.concat(dataframes, ignore_index=True)
    print(f"Total records after merging: {len(merged_df)}")
    
    return merged_df


def remove_duplicates(df: pd.DataFrame) -> pd.DataFrame:
    """
    Remove duplicates based on company + salary + title combination.
    
    Args:
        df: DataFrame with job data
        
    Returns:
        DataFrame with duplicates removed
    """
    print("\nRemoving duplicates...")
    print(f"Records before deduplication: {len(df)}")
    
    # Create a composite key for duplicate detection
    # Handle missing values by filling with empty strings
    df_clean = df.copy()
    df_clean['company'] = df_clean['company'].fillna('')
    df_clean['title'] = df_clean['title'].fillna('')
    df_clean['salary_low'] = df_clean['salary_low'].fillna(0)
    df_clean['salary_high'] = df_clean['salary_high'].fillna(0)
    
    # Create composite key
    df_clean['composite_key'] = (
        df_clean['company'].astype(str) + '|' +
        df_clean['title'].astype(str) + '|' +
        df_clean['salary_low'].astype(str) + '|' +
        df_clean['salary_high'].astype(str)
    )
    
    # Remove duplicates, keeping the first occurrence
    unique_df = df_clean.drop_duplicates(subset=['composite_key'], keep='first')
    
    # Remove the composite key column
    unique_df = unique_df.drop('composite_key', axis=1)
    
    duplicates_removed = len(df) - len(unique_df)
    print(f"Duplicates removed: {duplicates_removed}")
    print(f"Records after deduplication: {len(unique_df)}")
    
    return unique_df


def save_unique_dataset(df: pd.DataFrame, output_dir: str = "output") -> str:
    """
    Save the deduplicated dataset as a CSV file.
    
    Args:
        df: Deduplicated DataFrame
        output_dir: Output directory
        
    Returns:
        Path to the saved file
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"unique_jobs_{timestamp}.csv"
    filepath = os.path.join(output_dir, filename)
    
    df.to_csv(filepath, index=False)
    print(f"\nUnique dataset saved to: {filepath}")
    
    return filepath


def filter_recruiting_firms(df: pd.DataFrame) -> pd.DataFrame:
    """
    Filter out recruiting firms from the dataset using keyword matching.
    
    Args:
        df: DataFrame with job data
        
    Returns:
        DataFrame with recruiting firms removed
    """
    print("\nFiltering out recruiting firms...")
    
    # Keywords that indicate recruiting firms
    recruiter_keywords = ['recruit', 'career', 'job', 'consult']
    
    # Create a mask to identify recruiting firms
    is_recruiter = df['company'].str.lower().str.contains('|'.join(recruiter_keywords), na=False)
    
    recruiter_count = is_recruiter.sum()
    print(f"Found {recruiter_count} recruiting firms to filter out")
    
    # Filter out recruiting firms
    filtered_df = df[~is_recruiter].copy()
    
    print(f"Records after filtering: {len(filtered_df)} (removed {recruiter_count} recruiting firms)")
    
    return filtered_df


def analyze_companies_with_llm(df: pd.DataFrame) -> pd.DataFrame:
    """
    Group by company and industry, find top 10 companies with most openings.
    Use LLM to generate semantic analysis for each company.
    
    Args:
        df: DataFrame with job data
        
    Returns:
        DataFrame with company analytics and LLM insights
    """
    print("\nAnalyzing companies with LLM...")
    
    # Clean the data
    df_clean = df.copy()
    df_clean['company'] = df_clean['company'].fillna('Unknown')
    df_clean['industry'] = df_clean['industry'].fillna('Unknown')
    
    # Ensure salary columns are numeric
    df_clean['salary_low'] = pd.to_numeric(df_clean['salary_low'], errors='coerce')
    df_clean['salary_high'] = pd.to_numeric(df_clean['salary_high'], errors='coerce')
    
    # Group by company and industry
    company_stats = df_clean.groupby(['company', 'industry']).agg({
        'title': 'count',  # Count of job postings
        'salary_low': ['min', 'max', 'mean'],
        'salary_high': ['min', 'max', 'mean'],
        'location': lambda x: ', '.join(x.dropna().unique()[:3]),  # Top 3 locations
        'post_date': ['min', 'max']  # Date range
    }).round(2)
    
    # Add job titles separately
    job_titles_by_company = df_clean.groupby(['company', 'industry'])['title'].apply(lambda x: list(x.dropna().unique())).reset_index()
    job_titles_by_company.columns = ['company', 'industry', 'job_titles']
    
    # Flatten column names - check actual columns first
    print(f"Generated columns: {company_stats.columns.tolist()}")
    
    # Handle the multi-level columns properly
    company_stats.columns = [
        'job_count', 'min_salary_low', 'max_salary_low', 'avg_salary_low',
        'min_salary_high', 'max_salary_high', 'avg_salary_high',
        'top_locations', 'earliest_post', 'latest_post'
    ]
    
    # Reset index to make company and industry regular columns
    company_stats = company_stats.reset_index()
    
    # Merge with job titles
    company_stats = company_stats.merge(job_titles_by_company, on=['company', 'industry'], how='left')
    
    # Sort by job count and get top 30
    top_companies = company_stats.nlargest(30, 'job_count')
    
    print(f"Top 30 companies by job openings:")
    for idx, row in top_companies.iterrows():
        print(f"  {row['company']} ({row['industry']}): {row['job_count']} jobs")
    
    # Generate LLM analysis for each company
    print("\nGenerating LLM-powered company analysis...")
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    company_cards = []
    for idx, row in top_companies.iterrows():
        try:
            # Get detailed job information for this company
            company_jobs = df_clean[
                (df_clean['company'] == row['company']) & 
                (df_clean['industry'] == row['industry'])
            ][['title', 'salary_low', 'salary_high', 'url']].to_dict('records')
            
            company_card = generate_company_card(client, row, company_jobs)
            company_cards.append(company_card)
            print(f"  ✓ Analyzed {row['company']}")
        except Exception as e:
            logger.error(f"Error analyzing {row['company']}: {e}")
            # Add basic info if LLM fails
            company_jobs = df_clean[
                (df_clean['company'] == row['company']) & 
                (df_clean['industry'] == row['industry'])
            ][['title', 'salary_low', 'salary_high', 'url']].to_dict('records')
            
            company_card = {
                'company': row['company'],
                'industry': row['industry'],
                'job_count': row['job_count'],
                'hiring_intent_score': 5,  # Default score
                'main_job_types': 'Various positions',
                'client_potential': 'Company with active hiring needs',
                'is_recruiting_firm': False,
                'avg_salary_range': f"${row['avg_salary_low']:,.0f}-${row['avg_salary_high']:,.0f}",
                'job_details': company_jobs
            }
            company_cards.append(company_card)
    
    # Return list of dictionaries for JSON output
    return company_cards


def generate_company_card(client: OpenAI, company_data: pd.Series, job_details: List[Dict]) -> Dict[str, Any]:
    """
    Generate a company card using LLM analysis with detailed job information.
    
    Args:
        client: OpenAI client
        company_data: Company statistics
        job_details: List of detailed job information for this company
        
    Returns:
        Dictionary with company card information
    """
    # Prepare detailed job information
    job_details_str = ""
    for i, job in enumerate(job_details[:10]):  # Limit to first 10 jobs
        job_details_str += f"Job {i+1}: {job.get('title', 'N/A')} - ${job.get('salary_low', 0):,.0f}-${job.get('salary_high', 0):,.0f} - {job.get('url', 'N/A')}\n"
    
    prompt = f"""
Analyze this company's hiring patterns and create a "company card" for headhunters to identify potential clients.

Company: {company_data['company']}
Industry: {company_data['industry']}
Number of job openings: {company_data['job_count']}
Average salary range: ${company_data['avg_salary_low']:,.0f} - ${company_data['avg_salary_high']:,.0f}
Locations: {company_data['top_locations']}

Detailed Job Information:
{job_details_str}

ANALYSIS GUIDELINES:

1. HIRING INTENT SCORE (1-10):
   - 9-10: 15+ jobs, diverse roles, high salaries, urgent hiring patterns
   - 7-8: 8-14 jobs, consistent hiring, competitive salaries
   - 5-6: 4-7 jobs, moderate activity, standard salaries
   - 1-4: Few jobs, low activity, below-market salaries

2. MAIN JOB TYPES ANALYSIS:
   - Look for patterns in job titles (e.g., "Senior", "Lead", "Manager", "Director")
   - Identify skill categories (technical, sales, operations, finance, etc.)
   - Note specialization areas (AI/ML, fintech, healthcare, etc.)
   - Consider seniority levels and team structure implications

3. CLIENT POTENTIAL ASSESSMENT:
   - High-volume hiring (10+ jobs) = good for volume recruiters
   - High salaries (above market) = premium client potential
   - Diverse roles = multiple placement opportunities
   - Senior/executive roles = high-value placements
   - Technical specialization = niche expertise needed
   - Growth indicators (multiple similar roles) = expansion phase

4. RECRUITING FIRM DETECTION:
   - Job titles like "Recruiter", "Talent Acquisition", "HR Specialist"
   - Multiple companies hiring for same roles
   - Generic job descriptions
   - Agency-style language in job postings
   - High volume of temporary/contract roles

Please provide ONLY a JSON response with the following exact structure:
{{
  "hiring_intent_score": 8,
  "main_job_types": "Senior software engineers and technical leads specializing in fintech",
  "client_potential": "High-value client with 15+ senior tech roles, salaries 20% above market, expanding fintech division",
  "is_recruiting_firm": false
}}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": """You are an expert business analyst specializing in talent acquisition and recruitment. 

Your role is to analyze company hiring patterns and create actionable insights for headhunters to identify potential clients.

Key expertise areas:
- Salary benchmarking and market analysis
- Hiring pattern recognition and trend analysis
- Company growth stage assessment
- Recruiting firm identification
- Client potential evaluation

Always provide specific, data-driven insights based on job titles, salary ranges, and hiring volume. Focus on actionable intelligence that helps headhunters prioritize their prospecting efforts."""},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=600
        )
        
        # Parse JSON response
        response_content = response.choices[0].message.content.strip()
        print(f"LLM Response: {response_content[:200]}...")  # Debug output
        
        # Try to extract JSON from response
        try:
            llm_response = json.loads(response_content)
        except json.JSONDecodeError:
            # If JSON parsing fails, try to extract JSON from the response
            import re
            json_match = re.search(r'\{.*\}', response_content, re.DOTALL)
            if json_match:
                llm_response = json.loads(json_match.group())
            else:
                raise ValueError("No valid JSON found in response")
        
        return {
            'company': company_data['company'],
            'industry': company_data['industry'],
            'job_count': company_data['job_count'],
            'hiring_intent_score': llm_response.get('hiring_intent_score', 5),
            'main_job_types': llm_response.get('main_job_types', 'Various positions'),
            'client_potential': llm_response.get('client_potential', 'Company with active hiring needs'),
            'is_recruiting_firm': llm_response.get('is_recruiting_firm', False),
            'avg_salary_range': f"${company_data['avg_salary_low']:,.0f}-${company_data['avg_salary_high']:,.0f}",
            'top_locations': company_data['top_locations'],
            'job_details': job_details  # Include original job titles and URLs
        }
        
    except Exception as e:
        logger.error(f"LLM analysis failed for {company_data['company']}: {e}")
        raise


def save_company_analysis_json(company_cards: List[Dict], output_dir: str = "output") -> str:
    """
    Save company analysis to JSON file for website display.
    
    Args:
        company_cards: List of company card dictionaries
        output_dir: Output directory
        
    Returns:
        Path to the saved file
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"top_companies_{timestamp}.json"
    filepath = os.path.join(output_dir, filename)
    
    # Create the final JSON structure
    output_data = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "total_companies": len(company_cards),
            "description": "Top companies by job openings with LLM-powered analysis for headhunters"
        },
        "companies": company_cards
    }
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"\nCompany analysis saved to: {filepath}")
    
    return filepath


def save_company_analysis(df: pd.DataFrame, output_dir: str = "output") -> str:
    """
    Save company analysis to CSV file (legacy function).
    
    Args:
        df: Company analysis DataFrame
        output_dir: Output directory
        
    Returns:
        Path to the saved file
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"top_companies_{timestamp}.csv"
    filepath = os.path.join(output_dir, filename)
    
    df.to_csv(filepath, index=False)
    print(f"\nCompany analysis saved to: {filepath}")
    
    return filepath


def generate_summary_report(unique_df: pd.DataFrame, company_cards: List[Dict]) -> str:
    """
    Generate a summary report of the postprocessing results.
    
    Args:
        unique_df: Deduplicated job data
        company_cards: List of company card dictionaries
        
    Returns:
        Summary report text
    """
    report = f"""
POSTPROCESSING SUMMARY REPORT
Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

DATASET OVERVIEW:
- Total unique job postings: {len(unique_df):,}
- Number of unique companies: {unique_df['company'].nunique():,}
- Number of industries: {unique_df['industry'].nunique():,}
- Date range: {unique_df['post_date'].min()} to {unique_df['post_date'].max()}

TOP 30 COMPANIES BY JOB OPENINGS (Company Cards for Headhunters):
"""
    
    for idx, company in enumerate(company_cards):
        report += f"{idx+1:2d}. {company['company']} ({company['industry']})\n"
        report += f"    Jobs: {company['job_count']} | Hiring Intent Score: {company['hiring_intent_score']}/10\n"
        report += f"    Salary Range: {company['avg_salary_range']}\n"
        report += f"    Main Job Types: {company['main_job_types']}\n"
        report += f"    Client Potential: {company['client_potential']}\n"
        report += f"    Recruiting Firm: {'Yes' if company.get('is_recruiting_firm', False) else 'No'}\n"
        if 'top_locations' in company:
            report += f"    Locations: {company['top_locations']}\n\n"
        else:
            report += f"    Locations: N/A\n\n"
    
    report += f"""
SALARY STATISTICS:
- Average salary range: ${unique_df['salary_low'].mean():,.0f} - ${unique_df['salary_high'].mean():,.0f}
- Median salary range: ${unique_df['salary_low'].median():,.0f} - ${unique_df['salary_high'].median():,.0f}
- Highest salary: ${unique_df['salary_high'].max():,.0f}
- Lowest salary: ${unique_df['salary_low'].min():,.0f}

INDUSTRY BREAKDOWN:
"""
    
    industry_stats = unique_df['industry'].value_counts().head(10)
    for industry, count in industry_stats.items():
        report += f"- {industry}: {count:,} jobs\n"
    
    return report


def main():
    """Main function to run the postprocessing pipeline."""
    print("Starting postprocessing pipeline...")
    
    try:
        # Step 1: Merge all CSV files
        print("\n=== STEP 1: Merging CSV files ===")
        merged_df = merge_csv_files()
        
        # Step 2: Remove duplicates
        print("\n=== STEP 2: Removing duplicates ===")
        unique_df = remove_duplicates(merged_df)
        
        # Step 3: Save unique dataset
        print("\n=== STEP 3: Saving unique dataset ===")
        unique_file = save_unique_dataset(unique_df)
        
        # Step 4: Filter out recruiting firms
        print("\n=== STEP 4: Filtering out recruiting firms ===")
        filtered_df = filter_recruiting_firms(unique_df)
        
        # Step 5: Analyze companies with LLM
        print("\n=== STEP 5: Analyzing companies with LLM ===")
        company_cards = analyze_companies_with_llm(filtered_df)
        
        # Step 6: Save company analysis as JSON
        print("\n=== STEP 6: Saving company analysis as JSON ===")
        company_file = save_company_analysis_json(company_cards)
        
        # Generate summary report
        print("\n=== GENERATING SUMMARY REPORT ===")
        summary = generate_summary_report(unique_df, company_cards)
        
        # Save summary report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        summary_file = os.path.join("output", f"postprocessing_summary_{timestamp}.txt")
        with open(summary_file, 'w') as f:
            f.write(summary)
        
        print(f"\nSummary report saved to: {summary_file}")
        print("\n" + "="*50)
        print(summary)
        print("="*50)
        
        print(f"\n✅ Postprocessing completed successfully!")
        print(f"📁 Files generated:")
        print(f"   - Unique jobs: {unique_file}")
        print(f"   - Company analysis: {company_file}")
        print(f"   - Summary report: {summary_file}")
        
    except Exception as e:
        print(f"❌ Error during postprocessing: {e}")
        raise


if __name__ == "__main__":
    main()
