<new_features>
1. for each job, only extract raw text, including everything
2. save all raw texts in one file 
3. use LLM 4o-mini, to parse all raw text into json list, and then csv
4. key points to note:
 - for each job, it will usually say posting "today/yesterday". so we need to convert that into concrete date, based on the time we run this script
 - the fields required: 
   ## company
   ## title
   ## location
   ## industry 
   ## post_date
   ## salary range
   ## job type (full time / part time/ contract / permanent)
   ## raw text
</new_features>