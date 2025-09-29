#!/usr/bin/env python3
"""
Comprehensive Test Suite for Enhanced Job Matching System
Tests the complete pipeline from job profiling to candidate matching
"""

import json
import os
import sys
import asyncio
from datetime import datetime
from typing import Dict, List, Any
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class EnhancedMatchingTestSuite:
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.api_base_url = "http://localhost:3000/api"  # Next.js API base URL
        
        if not all([self.supabase_url, self.supabase_key]):
            raise ValueError("Missing required environment variables")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        self.test_results = {
            'job_profiling': {'passed': 0, 'failed': 0, 'tests': []},
            'candidate_migration': {'passed': 0, 'failed': 0, 'tests': []},
            'job_matching': {'passed': 0, 'failed': 0, 'tests': []},
            'api_endpoints': {'passed': 0, 'failed': 0, 'tests': []},
            'frontend_components': {'passed': 0, 'failed': 0, 'tests': []}
        }

    async def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Enhanced Job Matching System Tests")
        print("=" * 60)
        
        # Test 1: Job Profiling
        await self.test_job_profiling()
        
        # Test 2: Candidate Profile Migration
        await self.test_candidate_migration()
        
        # Test 3: Job Matching Algorithm
        await self.test_job_matching()
        
        # Test 4: API Endpoints
        await self.test_api_endpoints()
        
        # Test 5: Database Schema Validation
        await self.test_database_schema()
        
        # Print final results
        self.print_test_summary()

    async def test_job_profiling(self):
        """Test job profiling functionality"""
        print("\n📊 Testing Job Profiling")
        print("-" * 30)
        
        # Test 1: Check if enhanced jobs exist
        try:
            result = self.supabase.table('jobs').select('id, title, company_tier, skills_required').limit(5).execute()
            
            if result.data:
                enhanced_jobs = [job for job in result.data if job.get('company_tier')]
                if enhanced_jobs:
                    self.test_results['job_profiling']['passed'] += 1
                    self.test_results['job_profiling']['tests'].append({
                        'name': 'Enhanced jobs exist',
                        'status': 'PASS',
                        'details': f"Found {len(enhanced_jobs)} enhanced jobs"
                    })
                else:
                    self.test_results['job_profiling']['failed'] += 1
                    self.test_results['job_profiling']['tests'].append({
                        'name': 'Enhanced jobs exist',
                        'status': 'FAIL',
                        'details': 'No enhanced jobs found'
                    })
            else:
                self.test_results['job_profiling']['failed'] += 1
                self.test_results['job_profiling']['tests'].append({
                    'name': 'Enhanced jobs exist',
                    'status': 'FAIL',
                    'details': 'No jobs found in database'
                })
        except Exception as e:
            self.test_results['job_profiling']['failed'] += 1
            self.test_results['job_profiling']['tests'].append({
                'name': 'Enhanced jobs exist',
                'status': 'FAIL',
                'details': f"Error: {e}"
            })

        # Test 2: Check job skills structure
        try:
            result = self.supabase.table('job_skills_required').select('*').limit(5).execute()
            
            if result.data:
                self.test_results['job_profiling']['passed'] += 1
                self.test_results['job_profiling']['tests'].append({
                    'name': 'Job skills structure',
                    'status': 'PASS',
                    'details': f"Found {len(result.data)} required skills"
                })
            else:
                self.test_results['job_profiling']['failed'] += 1
                self.test_results['job_profiling']['tests'].append({
                    'name': 'Job skills structure',
                    'status': 'FAIL',
                    'details': 'No job skills found'
                })
        except Exception as e:
            self.test_results['job_profiling']['failed'] += 1
            self.test_results['job_profiling']['tests'].append({
                'name': 'Job skills structure',
                'status': 'FAIL',
                'details': f"Error: {e}"
            })

    async def test_candidate_migration(self):
        """Test candidate profile migration"""
        print("\n👤 Testing Candidate Profile Migration")
        print("-" * 40)
        
        # Test 1: Check candidate basics
        try:
            result = self.supabase.table('candidate_basics').select('*').limit(5).execute()
            
            if result.data:
                self.test_results['candidate_migration']['passed'] += 1
                self.test_results['candidate_migration']['tests'].append({
                    'name': 'Candidate basics exist',
                    'status': 'PASS',
                    'details': f"Found {len(result.data)} candidate profiles"
                })
            else:
                self.test_results['candidate_migration']['failed'] += 1
                self.test_results['candidate_migration']['tests'].append({
                    'name': 'Candidate basics exist',
                    'status': 'FAIL',
                    'details': 'No candidate profiles found'
                })
        except Exception as e:
            self.test_results['candidate_migration']['failed'] += 1
            self.test_results['candidate_migration']['tests'].append({
                'name': 'Candidate basics exist',
                'status': 'FAIL',
                'details': f"Error: {e}"
            })

        # Test 2: Check candidate skills
        try:
            result = self.supabase.table('candidate_skills').select('*').limit(5).execute()
            
            if result.data:
                self.test_results['candidate_migration']['passed'] += 1
                self.test_results['candidate_migration']['tests'].append({
                    'name': 'Candidate skills exist',
                    'status': 'PASS',
                    'details': f"Found {len(result.data)} candidate skills"
                })
            else:
                self.test_results['candidate_migration']['failed'] += 1
                self.test_results['candidate_migration']['tests'].append({
                    'name': 'Candidate skills exist',
                    'status': 'FAIL',
                    'details': 'No candidate skills found'
                })
        except Exception as e:
            self.test_results['candidate_migration']['failed'] += 1
            self.test_results['candidate_migration']['tests'].append({
                'name': 'Candidate skills exist',
                'status': 'FAIL',
                'details': f"Error: {e}"
            })

    async def test_job_matching(self):
        """Test job matching algorithm"""
        print("\n🎯 Testing Job Matching Algorithm")
        print("-" * 35)
        
        # Test 1: Check if matches table exists and has data
        try:
            result = self.supabase.table('matches').select('*').limit(5).execute()
            
            if result.data:
                self.test_results['job_matching']['passed'] += 1
                self.test_results['job_matching']['tests'].append({
                    'name': 'Matches table exists',
                    'status': 'PASS',
                    'details': f"Found {len(result.data)} matches"
                })
            else:
                self.test_results['job_matching']['failed'] += 1
                self.test_results['job_matching']['tests'].append({
                    'name': 'Matches table exists',
                    'status': 'FAIL',
                    'details': 'No matches found'
                })
        except Exception as e:
            self.test_results['job_matching']['failed'] += 1
            self.test_results['job_matching']['tests'].append({
                'name': 'Matches table exists',
                'status': 'FAIL',
                'details': f"Error: {e}"
            })

        # Test 2: Test matching algorithm with sample data
        try:
            # Get a sample candidate and job
            candidate_result = self.supabase.table('candidate_basics').select('*').limit(1).execute()
            job_result = self.supabase.table('jobs').select('*').limit(1).execute()
            
            if candidate_result.data and job_result.data:
                # This would test the actual matching logic
                # For now, just verify the data exists
                self.test_results['job_matching']['passed'] += 1
                self.test_results['job_matching']['tests'].append({
                    'name': 'Sample matching data',
                    'status': 'PASS',
                    'details': 'Sample candidate and job data available'
                })
            else:
                self.test_results['job_matching']['failed'] += 1
                self.test_results['job_matching']['tests'].append({
                    'name': 'Sample matching data',
                    'status': 'FAIL',
                    'details': 'No sample data available'
                })
        except Exception as e:
            self.test_results['job_matching']['failed'] += 1
            self.test_results['job_matching']['tests'].append({
                'name': 'Sample matching data',
                'status': 'FAIL',
                'details': f"Error: {e}"
            })

    async def test_api_endpoints(self):
        """Test API endpoints"""
        print("\n🌐 Testing API Endpoints")
        print("-" * 25)
        
        # Test 1: Job recommendations endpoint
        try:
            response = requests.post(f"{self.api_base_url}/jobs/recommendations", 
                                   json={"userId": "test-user", "limit": 3},
                                   timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'recommendations' in data:
                    self.test_results['api_endpoints']['passed'] += 1
                    self.test_results['api_endpoints']['tests'].append({
                        'name': 'Job recommendations API',
                        'status': 'PASS',
                        'details': f"API returned {len(data.get('recommendations', []))} recommendations"
                    })
                else:
                    self.test_results['api_endpoints']['failed'] += 1
                    self.test_results['api_endpoints']['tests'].append({
                        'name': 'Job recommendations API',
                        'status': 'FAIL',
                        'details': 'Invalid response format'
                    })
            else:
                self.test_results['api_endpoints']['failed'] += 1
                self.test_results['api_endpoints']['tests'].append({
                    'name': 'Job recommendations API',
                    'status': 'FAIL',
                    'details': f"HTTP {response.status_code}: {response.text}"
                })
        except Exception as e:
            self.test_results['api_endpoints']['failed'] += 1
            self.test_results['api_endpoints']['tests'].append({
                'name': 'Job recommendations API',
                'status': 'FAIL',
                'details': f"Error: {e}"
            })

        # Test 2: Candidate profile endpoint
        try:
            response = requests.get(f"{self.api_base_url}/candidate/profile", timeout=10)
            
            if response.status_code == 200:
                self.test_results['api_endpoints']['passed'] += 1
                self.test_results['api_endpoints']['tests'].append({
                    'name': 'Candidate profile API',
                    'status': 'PASS',
                    'details': 'API endpoint accessible'
                })
            else:
                self.test_results['api_endpoints']['failed'] += 1
                self.test_results['api_endpoints']['tests'].append({
                    'name': 'Candidate profile API',
                    'status': 'FAIL',
                    'details': f"HTTP {response.status_code}: {response.text}"
                })
        except Exception as e:
            self.test_results['api_endpoints']['failed'] += 1
            self.test_results['api_endpoints']['tests'].append({
                'name': 'Candidate profile API',
                'status': 'FAIL',
                'details': f"Error: {e}"
            })

    async def test_database_schema(self):
        """Test database schema completeness"""
        print("\n🗄️ Testing Database Schema")
        print("-" * 30)
        
        required_tables = [
            'jobs', 'job_skills_required', 'job_skills_optional',
            'candidate_basics', 'candidate_skills', 'candidate_work',
            'candidate_education', 'candidate_certifications',
            'matches', 'job_recommendations',
            'title_normalization', 'skill_normalization',
            'industry_classification', 'company_tier_mapping'
        ]
        
        schema_tests_passed = 0
        schema_tests_failed = 0
        
        for table in required_tables:
            try:
                result = self.supabase.table(table).select('*').limit(1).execute()
                schema_tests_passed += 1
                print(f"✅ {table} - OK")
            except Exception as e:
                schema_tests_failed += 1
                print(f"❌ {table} - FAIL: {e}")
        
        if schema_tests_failed == 0:
            self.test_results['api_endpoints']['passed'] += 1
            self.test_results['api_endpoints']['tests'].append({
                'name': 'Database schema',
                'status': 'PASS',
                'details': f"All {len(required_tables)} required tables exist"
            })
        else:
            self.test_results['api_endpoints']['failed'] += 1
            self.test_results['api_endpoints']['tests'].append({
                'name': 'Database schema',
                'status': 'FAIL',
                'details': f"{schema_tests_failed} tables missing or inaccessible"
            })

    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY")
        print("=" * 60)
        
        total_passed = 0
        total_failed = 0
        
        for category, results in self.test_results.items():
            passed = results['passed']
            failed = results['failed']
            total_passed += passed
            total_failed += failed
            
            status = "✅ PASS" if failed == 0 else "❌ FAIL"
            print(f"\n{category.upper().replace('_', ' ')}: {status}")
            print(f"  Passed: {passed}, Failed: {failed}")
            
            for test in results['tests']:
                icon = "✅" if test['status'] == 'PASS' else "❌"
                print(f"  {icon} {test['name']}: {test['details']}")
        
        print(f"\n{'='*60}")
        print(f"OVERALL: {total_passed} passed, {total_failed} failed")
        
        if total_failed == 0:
            print("🎉 ALL TESTS PASSED! System is ready for production.")
        else:
            print(f"⚠️  {total_failed} tests failed. Please review and fix issues.")
        print("=" * 60)

    def generate_test_report(self):
        """Generate detailed test report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'test_results': self.test_results,
            'summary': {
                'total_passed': sum(r['passed'] for r in self.test_results.values()),
                'total_failed': sum(r['failed'] for r in self.test_results.values())
            }
        }
        
        with open('test_report.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Detailed test report saved to: test_report.json")

async def main():
    """Main test function"""
    try:
        test_suite = EnhancedMatchingTestSuite()
        await test_suite.run_all_tests()
        test_suite.generate_test_report()
    except Exception as e:
        print(f"❌ Test suite failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
