<rules>
1. for the to-do list items, if you have done it, marked it done with a ticker emoji
2. you only need to implement those that have not been marked done
</rules>

<changes_needed>
9. keep the json_scraper + data refiner only and move the rests to an archive folder.
10. git commit
11. write a detailed todo items here to use supabase + tailwindcss + next.js to implement the newsletter system here. frontend to be deployed in vercel while for MVP, I will handle the email sending manually everyday by triggering python script locally

✅ 5. need to remove duplicates based on job hash, if duplicates, retain the newer one 
✅ 6. post_date needs to be an absolute data. you can reference th scrape_date. do not use today, 4 days ago etc.
✅ 7. try to do above within data refiner. 
✅ 8. remove one-time test script


✅ 3. the final output json might have fields incorrect. some are empty, some are clearly incorrect
   - loation is fine. unknown is okay
   - if an company is unknown, delete the record
   - salary low and high should be different
   - other missing fields. please check
   - all info shall be in raw text. however, the format in raw text might not be that uniform. analyze the data and find the rule.
   - given an input json, output a refined json

✅ 4. each job shall has a hash, with company + title + salary low + salary high


✅ 1. change the crawl url to 
     https://www.mycareersfuture.gov.sg/job/engineering?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0

     https://www.mycareersfuture.gov.sg/job/information-technology?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0

     https://www.mycareersfuture.gov.sg/job/banking-finance?salary=10000&postingCompany=Direct&sortBy=new_posting_date&page=0

     each url from page = 0 crawl to page = 50 or until the end

✅ 2. for the crawl, try to parse it into json, with same fields as current llm output
</changes_needed>

<regulation>
</regulation>

<new_features>
</new_features>

<other>
</other>

