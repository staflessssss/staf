# Wedding Full-Journey Matrix

Passed turns: 37/37
Passed scenarios: 14/14

| Scenario | Turn | User | Date | Location | Region | Tool | Response key | Next step | Mode | Handoff | Attachments | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
happy_path_available_raleigh | 1 | Hi, I'm interested |  |  | unknown |  | utter_ask_wedding_details | ask_missing_info | bot_active |  |  | PASS
happy_path_available_raleigh | 2 | October 3 2026 in Raleigh | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
happy_path_available_raleigh | 3 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
happy_path_available_raleigh | 4 | The Bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
happy_path_available_raleigh | 5 | Monday at 10am | 2026-10-03 | Raleigh | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
happy_path_available_raleigh | 6 | katie@example.com | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
happy_path_available_raleigh | 7 | Yes, book it | 2026-10-03 | Raleigh | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
rich_first_message_then_booking | 1 | Hi! We're Katie and Mike, wedding is Oct 3 2026 in Winston Salem, venue is The Bradford. Are you available? | 2026-10-03 | Winston Salem | NC_SC_GA | check_wedding_availability | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
rich_first_message_then_booking | 2 | Monday 10am works | 2026-10-03 | Winston Salem | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
rich_first_message_then_booking | 3 | katie@example.com | 2026-10-03 | Winston Salem | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
rich_first_message_then_booking | 4 | Yes | 2026-10-03 | Winston Salem | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
unknown_city_then_region_clarification | 1 | Wedding in Springfield on Oct 3 2026 | 2026-10-03 | Springfield | unknown |  | utter_first_turn_lead_region_clarification | ask_missing_info | bot_active |  |  | PASS
unknown_city_then_region_clarification | 2 | It's in North Carolina | 2026-10-03 | North Carolina | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
unknown_city_then_region_clarification | 3 | Katie and Mike | 2026-10-03 | North Carolina | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
unavailable_tampa | 1 | Wedding in Tampa on Oct 3 2026 | 2026-10-03 | Tampa | FL | check_wedding_availability | utter_first_turn_lead_unavailable | reply_only | bot_active |  |  | PASS
tool_error_then_recovery | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_first_turn_lead_tool_check | ask_missing_info | bot_active |  | pricing_guide | PASS
tool_error_then_recovery | 2 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_ask_venue | ask_venue | bot_active |  |  | PASS
price_shopper | 1 | How much? |  |  | unknown |  | utter_ask_wedding_details | ask_missing_info | bot_active |  | pricing_guide | PASS
price_shopper | 2 | Do you have availability Oct 3 2026 in Raleigh? | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  |  | PASS
price_shopper | 3 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
faq_interruption | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
faq_interruption | 2 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
faq_interruption | 3 | What's included? | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
faq_interruption | 4 | The Bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
location_correction | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
location_correction | 2 | Actually it's Winston Salem | 2026-10-03 | Winston Salem | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  |  | PASS
date_correction | 1 | Wedding in Tampa on Oct 3 2026 | 2026-10-03 | Tampa | FL | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
date_correction | 2 | Sorry, I meant Oct 10 2026 | 2026-10-10 | Tampa | FL | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  |  | PASS
team_question_before_details | 1 | Who will be filming our wedding? |  |  | unknown |  | utter_ask_wedding_details | reply_only | bot_active |  |  | PASS
team_question_before_details | 2 | October 3 2026 in Tampa | 2026-10-03 | Tampa | FL | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
invalid_call_time | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
invalid_call_time | 2 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
invalid_call_time | 3 | The Bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
invalid_call_time | 4 | Can we do Saturday at 8pm? | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_call_time_out_of_window | ask_call_time | bot_active |  |  | PASS
generic_opener_does_not_set_name | 1 | More info please |  |  | unknown |  | utter_ask_wedding_details | ask_missing_info | bot_active |  |  | PASS
speak_directly_with_taras_no_handoff | 1 | Can I speak directly with Taras? |  |  | unknown |  | utter_ask_wedding_details | reply_only | bot_active |  |  | PASS
real_person_request_human_review | 1 | Can I talk to a real person? |  |  | unknown |  | utter_handoff_ack | handoff | human_needed | customer_requests_human |  | PASS

## Transcripts

### happy_path_available_raleigh / Turn 1

User: Hi, I'm interested

```text
Hi! So happy you reached out 🤍 What wedding date and city are you planning for?
```

```json
{
  "extractedSlots": {},
  "slotsAfter": {
    "serviceRegion": "unknown",
    "availabilityToolStatus": "not_checked",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_wedding_details",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### happy_path_available_raleigh / Turn 2

User: October 3 2026 in Raleigh

```text
Great news — October 3, 2026 is available in Raleigh 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.
Also, we are running a 20% discount through June 30.
I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

```json
{
  "extractedSlots": {
    "weddingDate": "2026-10-03",
    "weddingDateText": "October 3 2026",
    "location": "Raleigh"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_availability_available_ask_names",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [
    "pricing_guide"
  ],
  "result": "PASS"
}
```

### happy_path_available_raleigh / Turn 3

User: Katie and Mike

```text
So nice to meet you both 🤍 Do you already have a venue picked out?
```

```json
{
  "extractedSlots": {
    "customerName": "Katie",
    "partnerName": "Mike"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_venue",
  "nextStep": "ask_venue",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### happy_path_available_raleigh / Turn 4

User: The Bradford

```text
Beautiful - The Bradford gives us a good starting point.

From here, the easiest next step is a quick consult so I can hear more about the day. What time works best? I do consults Monday-Friday, 9am-2pm Eastern.
```

```json
{
  "extractedSlots": {
    "venue": "The Bradford"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Bradford",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_venue_collected_ask_call_time",
  "nextStep": "ask_call_time",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### happy_path_available_raleigh / Turn 5

User: Monday at 10am

```text
10:00 AM works on my calendar.

What's the best email for the calendar invite?
```

```json
{
  "extractedSlots": {
    "proposedCallTime": "Monday at 10am"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Bradford",
    "proposedCallTime": "Monday at 10am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "10:00",
    "calendarStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_consultation_calendar"
  ],
  "responseKey": "utter_calendar_available_ask_email",
  "nextStep": "ask_email",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### happy_path_available_raleigh / Turn 6

User: katie@example.com

```text
Perfect, got it. Want me to lock in 10:00 AM?
```

```json
{
  "extractedSlots": {
    "email": "katie@example.com"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Bradford",
    "proposedCallTime": "Monday at 10am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "10:00",
    "calendarStatus": "available",
    "customerEmail": "katie@example.com",
    "pendingUserAction": {
      "type": "booking_confirmation",
      "slot": "Monday at 10am",
      "email": "katie@example.com"
    },
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_booking_confirmation",
  "nextStep": "ask_call_time",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### happy_path_available_raleigh / Turn 7

User: Yes, book it

```text
Done — I locked us in for 10:00 AM ✨

The calendar invite should come through at katie@example.com.
```

```json
{
  "extractedSlots": {},
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Bradford",
    "proposedCallTime": "Monday at 10am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "10:00",
    "calendarStatus": "available",
    "customerEmail": "katie@example.com",
    "pendingUserAction": null,
    "bookingConfirmed": true
  },
  "toolCalls": [
    "book_consultation"
  ],
  "responseKey": "utter_booking_confirmed",
  "nextStep": "reply_only",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### rich_first_message_then_booking / Turn 1

User: Hi! We're Katie and Mike, wedding is Oct 3 2026 in Winston Salem, venue is The Bradford. Are you available?

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news - I checked October 3, 2026 in Winston Salem, and the date is available 🤍 Our 8-hour wedding films start at $3,600 for NC/SC/GA. Also, we are running a 20% discount through June 30.

Beautiful - The Bradford gives us a good starting point.

From here, the easiest next step is a quick consult so I can hear more about the day. What time works best? I do consults Monday-Friday, 9am-2pm Eastern.
```

```json
{
  "extractedSlots": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateText": "Oct 3 2026",
    "location": "Winston Salem",
    "venue": "The Bradford"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Winston Salem",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Bradford",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_venue_collected_ask_call_time",
  "nextStep": "ask_call_time",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### rich_first_message_then_booking / Turn 2

User: Monday 10am works

```text
10:00 AM works on my calendar.

What's the best email for the calendar invite?
```

```json
{
  "extractedSlots": {
    "proposedCallTime": "Monday 10am"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Winston Salem",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Bradford",
    "proposedCallTime": "Monday 10am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "10:00",
    "calendarStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_consultation_calendar"
  ],
  "responseKey": "utter_calendar_available_ask_email",
  "nextStep": "ask_email",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### rich_first_message_then_booking / Turn 3

User: katie@example.com

```text
Perfect, got it. Want me to lock in 10:00 AM?
```

```json
{
  "extractedSlots": {
    "email": "katie@example.com"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Winston Salem",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Bradford",
    "proposedCallTime": "Monday 10am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "10:00",
    "calendarStatus": "available",
    "customerEmail": "katie@example.com",
    "pendingUserAction": {
      "type": "booking_confirmation",
      "slot": "Monday 10am",
      "email": "katie@example.com"
    },
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_booking_confirmation",
  "nextStep": "ask_call_time",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### rich_first_message_then_booking / Turn 4

User: Yes

```text
All set for 10:00 AM 🤍

You should get the calendar invite at katie@example.com.
```

```json
{
  "extractedSlots": {},
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Winston Salem",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Bradford",
    "proposedCallTime": "Monday 10am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "10:00",
    "calendarStatus": "available",
    "customerEmail": "katie@example.com",
    "pendingUserAction": null,
    "bookingConfirmed": true
  },
  "toolCalls": [
    "book_consultation"
  ],
  "responseKey": "utter_booking_confirmed",
  "nextStep": "reply_only",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### unknown_city_then_region_clarification / Turn 1

User: Wedding in Springfield on Oct 3 2026

```text
Hi! Thanks so much for reaching out 🤍

I have October 3, 2026 in Springfield. Just to confirm - is that in FL or NC/SC/GA?
```

```json
{
  "extractedSlots": {
    "weddingDate": "2026-10-03",
    "weddingDateText": "Oct 3 2026",
    "location": "Springfield"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Springfield",
    "serviceRegion": "unknown",
    "availabilityToolStatus": "needs_region",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_first_turn_lead_region_clarification",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### unknown_city_then_region_clarification / Turn 2

User: It's in North Carolina

```text
Great news — October 3, 2026 is available in North Carolina 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.
Also, we are running a 20% discount through June 30.
I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

```json
{
  "extractedSlots": {
    "location": "North Carolina"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "North Carolina",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_availability_available_ask_names",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [
    "pricing_guide"
  ],
  "result": "PASS"
}
```

### unknown_city_then_region_clarification / Turn 3

User: Katie and Mike

```text
So nice to meet you both 🤍 Do you already have a venue picked out?
```

```json
{
  "extractedSlots": {
    "customerName": "Katie",
    "partnerName": "Mike"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "North Carolina",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_venue",
  "nextStep": "ask_venue",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### unavailable_tampa / Turn 1

User: Wedding in Tampa on Oct 3 2026

```text
Hi! Thanks so much for reaching out 🤍

October 3, 2026 in Tampa is not open for us.

Our 8-hour wedding films start at $2,800 for Florida.
```

```json
{
  "extractedSlots": {
    "weddingDate": "2026-10-03",
    "weddingDateText": "Oct 3 2026",
    "location": "Tampa"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Tampa",
    "serviceRegion": "FL",
    "availability": "unavailable",
    "availabilityToolStatus": "unavailable",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_first_turn_lead_unavailable",
  "nextStep": "reply_only",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### tool_error_then_recovery / Turn 1

User: Wedding in Raleigh on Oct 3 2026

```text
Hi! Thanks so much for reaching out 🤍

I have October 3, 2026 in Raleigh. I’m having trouble checking availability right this second, so I don’t want to guess.

Our 8-hour wedding films start at $3,600 for NC/SC/GA, and I’ll send the collections guide here too 🎥

I’ll have the date checked and follow up shortly. In the meantime, what are both of your names?
```

```json
{
  "extractedSlots": {
    "weddingDate": "2026-10-03",
    "weddingDateText": "Oct 3 2026",
    "location": "Raleigh"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "unknown",
    "availabilityToolStatus": "tool_error",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_first_turn_lead_tool_check",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": true,
  "attachments": [
    "pricing_guide"
  ],
  "result": "PASS"
}
```

### tool_error_then_recovery / Turn 2

User: Katie and Mike

```text
Great news - I checked October 3, 2026 in Raleigh, and the date is available 🤍

So nice to meet you both! Do you already have a venue picked out?
```

```json
{
  "extractedSlots": {
    "customerName": "Katie",
    "partnerName": "Mike"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_ask_venue",
  "nextStep": "ask_venue",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### price_shopper / Turn 1

User: How much?

```text
Hi! Thanks so much for reaching out 🤍

Taras with Myndful Films. I’d love to help with the wedding film.

Our wedding films start at $2,800 for Florida and $3,600 for NC/SC/GA.

I’ll include the collections guide here so you can look through the options 🎥

What date are you looking at?
```

```json
{
  "extractedSlots": {},
  "slotsAfter": {
    "serviceRegion": "unknown",
    "availabilityToolStatus": "not_checked",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_wedding_details",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [
    "pricing_guide"
  ],
  "result": "PASS"
}
```

### price_shopper / Turn 2

User: Do you have availability Oct 3 2026 in Raleigh?

```text
I checked October 3, 2026 in Raleigh too, and that date is available 🤍

And what are both of your names? I’ll keep everything organized on my side.
```

```json
{
  "extractedSlots": {
    "weddingDate": "2026-10-03",
    "weddingDateText": "Oct 3 2026",
    "location": "Raleigh"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_availability_available_ask_names",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### price_shopper / Turn 3

User: Katie and Mike

```text
So nice to meet you both 🤍 Do you already have a venue picked out?
```

```json
{
  "extractedSlots": {
    "customerName": "Katie",
    "partnerName": "Mike"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_venue",
  "nextStep": "ask_venue",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### faq_interruption / Turn 1

User: Wedding in Raleigh on Oct 3 2026

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Raleigh 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.
Also, we are running a 20% discount through June 30.
I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

```json
{
  "extractedSlots": {
    "weddingDate": "2026-10-03",
    "weddingDateText": "Oct 3 2026",
    "location": "Raleigh"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_availability_available_ask_names",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [
    "pricing_guide"
  ],
  "result": "PASS"
}
```

### faq_interruption / Turn 2

User: Katie and Mike

```text
So nice to meet you both 🤍 Do you already have a venue picked out?
```

```json
{
  "extractedSlots": {
    "customerName": "Katie",
    "partnerName": "Mike"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_venue",
  "nextStep": "ask_venue",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### faq_interruption / Turn 3

User: What's included?

```text
Our wedding films include coverage, editing, licensed music, and online delivery. The exact collection depends on the package, and I can walk you through the guide.

So nice to meet you both! Do you already have a venue picked out?
```

```json
{
  "extractedSlots": {},
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_venue",
  "nextStep": "ask_venue",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### faq_interruption / Turn 4

User: The Bradford

```text
The Bradford gives us a helpful starting point.

The easiest next step is a quick consult so I can learn a little more about the day. What time works best? I do consults Monday-Friday, 9am-2pm Eastern.
```

```json
{
  "extractedSlots": {
    "venue": "The Bradford"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Bradford",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_venue_collected_ask_call_time",
  "nextStep": "ask_call_time",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### location_correction / Turn 1

User: Wedding in Raleigh on Oct 3 2026

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Raleigh 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.
Also, we are running a 20% discount through June 30.
I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

```json
{
  "extractedSlots": {
    "weddingDate": "2026-10-03",
    "weddingDateText": "Oct 3 2026",
    "location": "Raleigh"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_availability_available_ask_names",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [
    "pricing_guide"
  ],
  "result": "PASS"
}
```

### location_correction / Turn 2

User: Actually it's Winston Salem

```text
I checked Winston Salem too, and October 3, 2026 is still available there 🤍

And what are both of your names? I’ll keep everything organized on my side.
```

```json
{
  "extractedSlots": {
    "location": "Winston Salem"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Winston Salem",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_availability_available_ask_names",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### date_correction / Turn 1

User: Wedding in Tampa on Oct 3 2026

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Tampa 🤍

Our 8-hour wedding films start at $2,800 for Florida.
Also, we are running a 20% discount through June 30.
I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

```json
{
  "extractedSlots": {
    "weddingDate": "2026-10-03",
    "weddingDateText": "Oct 3 2026",
    "location": "Tampa"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Tampa",
    "serviceRegion": "FL",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_availability_available_ask_names",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [
    "pricing_guide"
  ],
  "result": "PASS"
}
```

### date_correction / Turn 2

User: Sorry, I meant Oct 10 2026

```text
I checked October 10, 2026 in Tampa too, and that date is available 🤍

And what are both of your names? I’ll keep everything organized on my side.
```

```json
{
  "extractedSlots": {
    "weddingDate": "2026-10-10",
    "weddingDateText": "Oct 10 2026"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-10",
    "weddingDateDisplay": "October 10, 2026",
    "location": "Tampa",
    "serviceRegion": "FL",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_availability_available_ask_names",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### team_question_before_details / Turn 1

User: Who will be filming our wedding?

```text
Hi! Thanks so much for reaching out 🤍

Taras with Myndful Films. I’d love to help with the wedding film.

The exact filmmaker depends on the wedding location and availability.

What wedding date and city are you planning for?
```

```json
{
  "extractedSlots": {},
  "slotsAfter": {
    "serviceRegion": "unknown",
    "availabilityToolStatus": "not_checked",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_wedding_details",
  "nextStep": "reply_only",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### team_question_before_details / Turn 2

User: October 3 2026 in Tampa

```text
Great news — October 3, 2026 is available in Tampa 🤍

Our 8-hour wedding films start at $2,800 for Florida.
Also, we are running a 20% discount through June 30.
I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

```json
{
  "extractedSlots": {
    "weddingDate": "2026-10-03",
    "weddingDateText": "October 3 2026",
    "location": "Tampa"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Tampa",
    "serviceRegion": "FL",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_availability_available_ask_names",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [
    "pricing_guide"
  ],
  "result": "PASS"
}
```

### invalid_call_time / Turn 1

User: Wedding in Raleigh on Oct 3 2026

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Raleigh 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.
Also, we are running a 20% discount through June 30.
I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

```json
{
  "extractedSlots": {
    "weddingDate": "2026-10-03",
    "weddingDateText": "Oct 3 2026",
    "location": "Raleigh"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_wedding_availability"
  ],
  "responseKey": "utter_availability_available_ask_names",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [
    "pricing_guide"
  ],
  "result": "PASS"
}
```

### invalid_call_time / Turn 2

User: Katie and Mike

```text
So nice to meet you both 🤍 Do you already have a venue picked out?
```

```json
{
  "extractedSlots": {
    "customerName": "Katie",
    "partnerName": "Mike"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_venue",
  "nextStep": "ask_venue",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### invalid_call_time / Turn 3

User: The Bradford

```text
Beautiful - The Bradford gives us a good starting point.

From here, the easiest next step is a quick consult so I can hear more about the day. What time works best? I do consults Monday-Friday, 9am-2pm Eastern.
```

```json
{
  "extractedSlots": {
    "venue": "The Bradford"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Bradford",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_venue_collected_ask_call_time",
  "nextStep": "ask_call_time",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### invalid_call_time / Turn 4

User: Can we do Saturday at 8pm?

```text
8pm is just outside my consult window - I do calls Monday-Friday, 9am-2pm Eastern. Would 1pm or 2pm work?
```

```json
{
  "extractedSlots": {
    "proposedCallTime": "Saturday at 8pm"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Bradford",
    "pendingUserAction": {
      "type": "call_time_choice",
      "options": [
        "1pm",
        "2pm"
      ],
      "dateContext": "saturday"
    },
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_call_time_out_of_window",
  "nextStep": "ask_call_time",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### generic_opener_does_not_set_name / Turn 1

User: More info please

```text
Hi! So happy you reached out 🤍 What wedding date and city are you planning for?
```

```json
{
  "extractedSlots": {},
  "slotsAfter": {
    "serviceRegion": "unknown",
    "availabilityToolStatus": "not_checked",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_wedding_details",
  "nextStep": "ask_missing_info",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### speak_directly_with_taras_no_handoff / Turn 1

User: Can I speak directly with Taras?

```text
Hi! Thanks so much for reaching out 🤍

Taras with Myndful Films. I’d love to help with the wedding film.

Absolutely - you're speaking with me here. I'm Taras, and I'm happy to go over anything you'd like before we finish 🤍

What date are you looking at?
```

```json
{
  "extractedSlots": {},
  "slotsAfter": {
    "serviceRegion": "unknown",
    "availabilityToolStatus": "not_checked",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_ask_wedding_details",
  "nextStep": "reply_only",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### real_person_request_human_review / Turn 1

User: Can I talk to a real person?

```text
Good question — let me double-check that so I don't give you the wrong answer. I'll follow up here shortly 🤍
```

```json
{
  "extractedSlots": {},
  "slotsAfter": {
    "serviceRegion": "unknown",
    "availabilityToolStatus": "not_checked",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [],
  "responseKey": "utter_handoff_ack",
  "nextStep": "handoff",
  "mode": "human_needed",
  "handoffReason": "customer_requests_human",
  "escalated": true,
  "humanReviewRequired": true,
  "attachments": [],
  "result": "PASS"
}
```
