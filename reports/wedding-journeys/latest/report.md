# Wedding Full-Journey Matrix

Passed turns: 118/118
Passed scenarios: 24/24

## Scenario Summary

Total scenarios: 24
Total turns: 118
Final booked: 14
Final human review: 2
Final unavailable: 0
Final waiting clarification: 9
Final abandoned: 0

## Failures By Scenario

None

| Scenario | Turn | User | Date | Location | Region | Tool | Response key | Next step | Mode | Handoff | Attachments | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
happy_path_available_raleigh | 1 | Hi, I'm interested |  |  | unknown |  | utter_ask_wedding_details | ask_missing_info | bot_active |  |  | PASS
happy_path_available_raleigh | 2 | October 3 2026 in Raleigh | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
happy_path_available_raleigh | 3 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
happy_path_available_raleigh | 4 | The Bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
happy_path_available_raleigh | 5 | Monday at 10am | 2026-10-03 | Raleigh | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
happy_path_available_raleigh | 6 | katie@example.com | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
happy_path_available_raleigh | 7 | Yes, book it | 2026-10-03 | Raleigh | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
rich_first_message_then_booking | 1 | Hi! We're Katie and Mike. Wedding is Oct 3 2026 in Winston Salem. Venue is The Bradford. Are you available? | 2026-10-03 | Winston Salem | NC_SC_GA | check_wedding_availability | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
rich_first_message_then_booking | 2 | Monday 10am works | 2026-10-03 | Winston Salem | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
rich_first_message_then_booking | 3 | katie@example.com | 2026-10-03 | Winston Salem | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
rich_first_message_then_booking | 4 | Yes | 2026-10-03 | Winston Salem | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
unknown_city_then_region_clarification_to_booking | 1 | Wedding in Springfield on Oct 3 2026 | 2026-10-03 | Springfield | unknown |  | utter_first_turn_lead_region_clarification | ask_missing_info | bot_active |  |  | PASS
unknown_city_then_region_clarification_to_booking | 2 | It's in North Carolina | 2026-10-03 | North Carolina | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
unknown_city_then_region_clarification_to_booking | 3 | Katie and Mike | 2026-10-03 | North Carolina | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
unknown_city_then_region_clarification_to_booking | 4 | The Bradford | 2026-10-03 | North Carolina | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
unknown_city_then_region_clarification_to_booking | 5 | Monday 10am | 2026-10-03 | North Carolina | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
unknown_city_then_region_clarification_to_booking | 6 | katie@example.com | 2026-10-03 | North Carolina | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
unknown_city_then_region_clarification_to_booking | 7 | Yes | 2026-10-03 | North Carolina | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
unavailable_then_alternative_date_booking | 1 | Wedding in Tampa on Oct 3 2026 | 2026-10-03 | Tampa | FL | check_wedding_availability | utter_first_turn_lead_unavailable | reply_only | bot_active |  |  | PASS
unavailable_then_alternative_date_booking | 2 | What about Oct 10 2026? | 2026-10-10 | Tampa | FL | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
unavailable_then_alternative_date_booking | 3 | Katie and Mike | 2026-10-10 | Tampa | FL |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
unavailable_then_alternative_date_booking | 4 | The Vinoy | 2026-10-10 | Tampa | FL |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
unavailable_then_alternative_date_booking | 5 | Tuesday 11am | 2026-10-10 | Tampa | FL | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
unavailable_then_alternative_date_booking | 6 | katie@example.com | 2026-10-10 | Tampa | FL |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
unavailable_then_alternative_date_booking | 7 | Yes | 2026-10-10 | Tampa | FL | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
tool_error_then_recovery_booking | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_first_turn_lead_tool_check | ask_missing_info | bot_active |  | pricing_guide | PASS
tool_error_then_recovery_booking | 2 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_ask_venue | ask_venue | bot_active |  |  | PASS
tool_error_then_recovery_booking | 3 | The Bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
tool_error_then_recovery_booking | 4 | Monday 10am | 2026-10-03 | Raleigh | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
tool_error_then_recovery_booking | 5 | katie@example.com | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
tool_error_then_recovery_booking | 6 | Yes | 2026-10-03 | Raleigh | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
price_shopper_full | 1 | How much? |  |  | unknown |  | utter_ask_wedding_details | ask_missing_info | bot_active |  | pricing_guide | PASS
price_shopper_full | 2 | Do you have Oct 3 2026 in Raleigh? | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  |  | PASS
price_shopper_full | 3 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
price_shopper_full | 4 | The Bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
price_shopper_full | 5 | Monday 10am | 2026-10-03 | Raleigh | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
price_shopper_full | 6 | katie@example.com | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
price_shopper_full | 7 | Yes | 2026-10-03 | Raleigh | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
budget_objection | 1 | How much? |  |  | unknown |  | utter_ask_wedding_details | ask_missing_info | bot_active |  | pricing_guide | PASS
budget_objection | 2 | That's too expensive |  |  | unknown |  | utter_ask_wedding_details | ask_missing_info | bot_active |  |  | PASS
budget_objection | 3 | Do you have anything cheaper? |  |  | unknown |  | utter_ask_wedding_details | ask_missing_info | bot_active |  |  | PASS
discount_pressure | 1 | Do you have discounts? |  |  | unknown |  | utter_ask_wedding_details | ask_missing_info | bot_active |  | pricing_guide | PASS
discount_pressure | 2 | Can you do $1000? |  |  | unknown |  | utter_ask_wedding_details | ask_missing_info | bot_active |  |  | PASS
faq_interruption_full_booking | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
faq_interruption_full_booking | 2 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
faq_interruption_full_booking | 3 | What's included? | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
faq_interruption_full_booking | 4 | The Bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
faq_interruption_full_booking | 5 | Monday 10am | 2026-10-03 | Raleigh | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
faq_interruption_full_booking | 6 | katie@example.com | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
faq_interruption_full_booking | 7 | Yes | 2026-10-03 | Raleigh | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
style_faq_before_date | 1 | What's your filming style? |  |  | unknown |  | utter_ask_wedding_details | ask_missing_info | bot_active |  |  | PASS
style_faq_before_date | 2 | Do you have Oct 3 2026 in Tampa? | 2026-10-03 | Tampa | FL | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
style_faq_before_date | 3 | Katie and Mike | 2026-10-03 | Tampa | FL |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
team_question_before_details_to_booking | 1 | Who will be filming our wedding? |  |  | unknown |  | utter_ask_wedding_details | reply_only | bot_active |  |  | PASS
team_question_before_details_to_booking | 2 | October 3 2026 in Tampa | 2026-10-03 | Tampa | FL | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
team_question_before_details_to_booking | 3 | Katie and Mike | 2026-10-03 | Tampa | FL |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
team_question_before_details_to_booking | 4 | The Vinoy | 2026-10-03 | Tampa | FL |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
team_question_before_details_to_booking | 5 | Monday 10am | 2026-10-03 | Tampa | FL | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
team_question_before_details_to_booking | 6 | katie@example.com | 2026-10-03 | Tampa | FL |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
team_question_before_details_to_booking | 7 | Yes | 2026-10-03 | Tampa | FL | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
human_request_handoff | 1 | Can I talk to a real person? |  |  | unknown |  | utter_handoff_ack | handoff | human_needed | customer_requests_human |  | PASS
speak_directly_with_taras_no_handoff | 1 | Can I speak directly with Taras? |  |  | unknown |  | utter_ask_wedding_details | reply_only | bot_active |  |  | PASS
speak_directly_with_taras_no_handoff | 2 | October 3 2026 in Raleigh | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
location_correction_full | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
location_correction_full | 2 | Actually it's Winston Salem | 2026-10-03 | Winston Salem | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  |  | PASS
location_correction_full | 3 | Katie and Mike | 2026-10-03 | Winston Salem | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
date_correction_full | 1 | Wedding in Tampa on Oct 3 2026 | 2026-10-03 | Tampa | FL | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
date_correction_full | 2 | Sorry I meant Oct 10 2026 | 2026-10-10 | Tampa | FL | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  |  | PASS
date_correction_full | 3 | Katie and Mike | 2026-10-10 | Tampa | FL |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
names_correction | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
names_correction | 2 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
names_correction | 3 | Actually my partner is John, not Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
email_typo_correction_booking | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
email_typo_correction_booking | 2 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
email_typo_correction_booking | 3 | The Bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
email_typo_correction_booking | 4 | Monday 10am | 2026-10-03 | Raleigh | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
email_typo_correction_booking | 5 | katy@gmal.com | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
email_typo_correction_booking | 6 | Sorry typo: katie@gmail.com | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
email_typo_correction_booking | 7 | Yes | 2026-10-03 | Raleigh | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
invalid_call_time_then_valid_booking | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
invalid_call_time_then_valid_booking | 2 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
invalid_call_time_then_valid_booking | 3 | The Bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
invalid_call_time_then_valid_booking | 4 | Can we do Saturday at 8pm? | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_call_time_out_of_window | ask_call_time | bot_active |  |  | PASS
invalid_call_time_then_valid_booking | 5 | Monday at 10am | 2026-10-03 | Raleigh | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
invalid_call_time_then_valid_booking | 6 | katie@example.com | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
invalid_call_time_then_valid_booking | 7 | Yes | 2026-10-03 | Raleigh | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
calendar_busy_then_suggested_time_booking | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
calendar_busy_then_suggested_time_booking | 2 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
calendar_busy_then_suggested_time_booking | 3 | The Bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
calendar_busy_then_suggested_time_booking | 4 | Monday at 10am | 2026-10-03 | Raleigh | NC_SC_GA | check_consultation_calendar |  | reply_only | bot_active |  |  | PASS
calendar_busy_then_suggested_time_booking | 5 | 11am works | 2026-10-03 | Raleigh | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
calendar_busy_then_suggested_time_booking | 6 | katie@example.com | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
calendar_busy_then_suggested_time_booking | 7 | Yes | 2026-10-03 | Raleigh | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
post_booking_thanks_no_duplicate_booking | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
post_booking_thanks_no_duplicate_booking | 2 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
post_booking_thanks_no_duplicate_booking | 3 | The Bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
post_booking_thanks_no_duplicate_booking | 4 | Monday 10am | 2026-10-03 | Raleigh | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
post_booking_thanks_no_duplicate_booking | 5 | katie@example.com | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
post_booking_thanks_no_duplicate_booking | 6 | Yes | 2026-10-03 | Raleigh | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
post_booking_thanks_no_duplicate_booking | 7 | Thanks, see you then | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_acknowledgement | reply_only | bot_active |  |  | PASS
post_booking_reschedule_request | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
post_booking_reschedule_request | 2 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
post_booking_reschedule_request | 3 | The Bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
post_booking_reschedule_request | 4 | Monday 10am | 2026-10-03 | Raleigh | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
post_booking_reschedule_request | 5 | katie@example.com | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
post_booking_reschedule_request | 6 | Yes | 2026-10-03 | Raleigh | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
post_booking_reschedule_request | 7 | Actually can we reschedule? | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_handoff_ack | handoff | human_needed | customer_requests_human |  | PASS
out_of_region_new_york | 1 | Wedding in New York on Oct 3 2026 | 2026-10-03 | New York | unknown |  | utter_first_turn_lead_region_clarification | ask_missing_info | bot_active |  |  | PASS
messy_casual_short_messages | 1 | yo need video |  |  | unknown |  | utter_ask_wedding_details | ask_missing_info | bot_active |  |  | PASS
messy_casual_short_messages | 2 | oct 3 2026 raleigh | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
messy_casual_short_messages | 3 | katie n mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS
messy_casual_short_messages | 4 | bradford | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_venue_collected_ask_call_time | ask_call_time | bot_active |  |  | PASS
messy_casual_short_messages | 5 | mon 10am | 2026-10-03 | Raleigh | NC_SC_GA | check_consultation_calendar | utter_calendar_available_ask_email | ask_email | bot_active |  |  | PASS
messy_casual_short_messages | 6 | katie@example.com | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_booking_confirmation | ask_call_time | bot_active |  |  | PASS
messy_casual_short_messages | 7 | yeah | 2026-10-03 | Raleigh | NC_SC_GA | book_consultation | utter_booking_confirmed | reply_only | bot_active |  |  | PASS
duplicate_inbound_no_duplicate_guide | 1 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  | pricing_guide | PASS
duplicate_inbound_no_duplicate_guide | 2 | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | utter_availability_available_ask_names | ask_missing_info | bot_active |  |  | PASS
duplicate_inbound_no_duplicate_guide | 3 | Katie and Mike | 2026-10-03 | Raleigh | NC_SC_GA |  | utter_ask_venue | ask_venue | bot_active |  |  | PASS

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

User: Hi! We're Katie and Mike. Wedding is Oct 3 2026 in Winston Salem. Venue is The Bradford. Are you available?

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

### unknown_city_then_region_clarification_to_booking / Turn 1

User: Wedding in Springfield on Oct 3 2026

```text
Hi! Thanks so much for reaching out 🤍

I have October 3, 2026 in Springfield. Our main coverage areas are Florida and NC/SC/GA. Is this a travel wedding, or are you asking about one of those areas?
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

### unknown_city_then_region_clarification_to_booking / Turn 2

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

### unknown_city_then_region_clarification_to_booking / Turn 3

User: Katie and Mike

```text
Love it. What venue are you two planning for?
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

### unknown_city_then_region_clarification_to_booking / Turn 4

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
    "location": "North Carolina",
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

### unknown_city_then_region_clarification_to_booking / Turn 5

User: Monday 10am

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
    "location": "North Carolina",
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

### unknown_city_then_region_clarification_to_booking / Turn 6

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
    "location": "North Carolina",
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

### unknown_city_then_region_clarification_to_booking / Turn 7

User: Yes

```text
Perfect — you're all set for 10:00 AM ✨

You should see the calendar invite come through at katie@example.com.
```

```json
{
  "extractedSlots": {},
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "North Carolina",
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

### unavailable_then_alternative_date_booking / Turn 1

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

### unavailable_then_alternative_date_booking / Turn 2

User: What about Oct 10 2026?

```text
I checked October 10, 2026 in Tampa too, and that date is available 🤍

Also, we are running a 20% discount through June 30.

I’ll include the collections guide here so you can look through the options 🎥

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
  "attachments": [
    "pricing_guide"
  ],
  "result": "PASS"
}
```

### unavailable_then_alternative_date_booking / Turn 3

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
    "weddingDate": "2026-10-10",
    "weddingDateDisplay": "October 10, 2026",
    "location": "Tampa",
    "serviceRegion": "FL",
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

### unavailable_then_alternative_date_booking / Turn 4

User: The Vinoy

```text
Beautiful - The Vinoy gives us a good starting point.

From here, the easiest next step is a quick consult so I can hear more about the day. What time works best? I do consults Monday-Friday, 9am-2pm Eastern.
```

```json
{
  "extractedSlots": {
    "venue": "The Vinoy"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-10",
    "weddingDateDisplay": "October 10, 2026",
    "location": "Tampa",
    "serviceRegion": "FL",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Vinoy",
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

### unavailable_then_alternative_date_booking / Turn 5

User: Tuesday 11am

```text
11:00 AM works on my calendar.

What's the best email for the calendar invite?
```

```json
{
  "extractedSlots": {
    "proposedCallTime": "Tuesday 11am"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-10",
    "weddingDateDisplay": "October 10, 2026",
    "location": "Tampa",
    "serviceRegion": "FL",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Vinoy",
    "proposedCallTime": "Tuesday 11am",
    "checkedCallDate": "2026-10-06",
    "checkedCallTime": "11:00",
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

### unavailable_then_alternative_date_booking / Turn 6

User: katie@example.com

```text
Perfect, got it. Want me to lock in 11:00 AM?
```

```json
{
  "extractedSlots": {
    "email": "katie@example.com"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-10",
    "weddingDateDisplay": "October 10, 2026",
    "location": "Tampa",
    "serviceRegion": "FL",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Vinoy",
    "proposedCallTime": "Tuesday 11am",
    "checkedCallDate": "2026-10-06",
    "checkedCallTime": "11:00",
    "calendarStatus": "available",
    "customerEmail": "katie@example.com",
    "pendingUserAction": {
      "type": "booking_confirmation",
      "slot": "Tuesday 11am",
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

### unavailable_then_alternative_date_booking / Turn 7

User: Yes

```text
Perfect — you're all set for 11:00 AM ✨

You should see the calendar invite come through at katie@example.com.
```

```json
{
  "extractedSlots": {},
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-10",
    "weddingDateDisplay": "October 10, 2026",
    "location": "Tampa",
    "serviceRegion": "FL",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Vinoy",
    "proposedCallTime": "Tuesday 11am",
    "checkedCallDate": "2026-10-06",
    "checkedCallTime": "11:00",
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

### tool_error_then_recovery_booking / Turn 1

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

### tool_error_then_recovery_booking / Turn 2

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

### tool_error_then_recovery_booking / Turn 3

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

### tool_error_then_recovery_booking / Turn 4

User: Monday 10am

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
    "location": "Raleigh",
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

### tool_error_then_recovery_booking / Turn 5

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

### tool_error_then_recovery_booking / Turn 6

User: Yes

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

### price_shopper_full / Turn 1

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

### price_shopper_full / Turn 2

User: Do you have Oct 3 2026 in Raleigh?

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

### price_shopper_full / Turn 3

User: Katie and Mike

```text
Love it. What venue are you two planning for?
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

### price_shopper_full / Turn 4

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

### price_shopper_full / Turn 5

User: Monday 10am

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
    "location": "Raleigh",
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

### price_shopper_full / Turn 6

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

### price_shopper_full / Turn 7

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
    "location": "Raleigh",
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

### budget_objection / Turn 1

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

### budget_objection / Turn 2

User: That's too expensive

```text
I totally understand wanting to stay within budget 🤍

Our 8-hour wedding films start at $2,800 for Florida and $3,600 for NC/SC/GA. I can't promise a custom discount here, but we can look through the collection options together.

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
  "attachments": [],
  "result": "PASS"
}
```

### budget_objection / Turn 3

User: Do you have anything cheaper?

```text
I totally understand wanting to stay within budget 🤍

Our 8-hour wedding films start at $2,800 for Florida and $3,600 for NC/SC/GA. I can't promise a custom discount here, but we can look through the collection options together.

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
  "attachments": [],
  "result": "PASS"
}
```

### discount_pressure / Turn 1

User: Do you have discounts?

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

### discount_pressure / Turn 2

User: Can you do $1000?

```text
I totally understand wanting to stay within budget 🤍

Our 8-hour wedding films start at $2,800 for Florida and $3,600 for NC/SC/GA. I can't promise a custom discount here, but we can look through the collection options together.

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
  "attachments": [],
  "result": "PASS"
}
```

### faq_interruption_full_booking / Turn 1

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

### faq_interruption_full_booking / Turn 2

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

### faq_interruption_full_booking / Turn 3

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

### faq_interruption_full_booking / Turn 4

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

### faq_interruption_full_booking / Turn 5

User: Monday 10am

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
    "location": "Raleigh",
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

### faq_interruption_full_booking / Turn 6

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

### faq_interruption_full_booking / Turn 7

User: Yes

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

### style_faq_before_date / Turn 1

User: What's your filming style?

```text
Hi! Thanks so much for reaching out 🤍

Taras with Myndful Films. I’d love to help with the wedding film.

Our style is cinematic but natural and documentary-leaning - focused on real moments, clean audio, and a film that feels like your day.

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
  "attachments": [],
  "result": "PASS"
}
```

### style_faq_before_date / Turn 2

User: Do you have Oct 3 2026 in Tampa?

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

### style_faq_before_date / Turn 3

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
    "location": "Tampa",
    "serviceRegion": "FL",
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

### team_question_before_details_to_booking / Turn 1

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

### team_question_before_details_to_booking / Turn 2

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

### team_question_before_details_to_booking / Turn 3

User: Katie and Mike

```text
Love it. What venue are you two planning for?
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
    "location": "Tampa",
    "serviceRegion": "FL",
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

### team_question_before_details_to_booking / Turn 4

User: The Vinoy

```text
Beautiful - The Vinoy gives us a good starting point.

From here, the easiest next step is a quick consult so I can hear more about the day. What time works best? I do consults Monday-Friday, 9am-2pm Eastern.
```

```json
{
  "extractedSlots": {
    "venue": "The Vinoy"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "Mike",
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "Tampa",
    "serviceRegion": "FL",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Vinoy",
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

### team_question_before_details_to_booking / Turn 5

User: Monday 10am

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
    "location": "Tampa",
    "serviceRegion": "FL",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Vinoy",
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

### team_question_before_details_to_booking / Turn 6

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
    "location": "Tampa",
    "serviceRegion": "FL",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Vinoy",
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

### team_question_before_details_to_booking / Turn 7

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
    "location": "Tampa",
    "serviceRegion": "FL",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Vinoy",
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

### human_request_handoff / Turn 1

User: Can I talk to a real person?

```text
Totally - I'll have a real person from the team follow up here shortly 🤍
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

### speak_directly_with_taras_no_handoff / Turn 2

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

### location_correction_full / Turn 1

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

### location_correction_full / Turn 2

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

### location_correction_full / Turn 3

User: Katie and Mike

```text
Love it. What venue are you two planning for?
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
    "location": "Winston Salem",
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

### date_correction_full / Turn 1

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

### date_correction_full / Turn 2

User: Sorry I meant Oct 10 2026

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

### date_correction_full / Turn 3

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
    "weddingDate": "2026-10-10",
    "weddingDateDisplay": "October 10, 2026",
    "location": "Tampa",
    "serviceRegion": "FL",
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

### names_correction / Turn 1

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

### names_correction / Turn 2

User: Katie and Mike

```text
Love it. What venue are you two planning for?
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

### names_correction / Turn 3

User: Actually my partner is John, not Mike

```text
So nice to meet you both 🤍 Do you already have a venue picked out?
```

```json
{
  "extractedSlots": {
    "partnerName": "John"
  },
  "slotsAfter": {
    "customerName": "Katie",
    "partnerName": "John",
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

### email_typo_correction_booking / Turn 1

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

### email_typo_correction_booking / Turn 2

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

### email_typo_correction_booking / Turn 3

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

### email_typo_correction_booking / Turn 4

User: Monday 10am

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
    "location": "Raleigh",
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

### email_typo_correction_booking / Turn 5

User: katy@gmal.com

```text
Perfect, got it. Want me to lock in 10:00 AM?
```

```json
{
  "extractedSlots": {
    "email": "katy@gmal.com"
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
    "proposedCallTime": "Monday 10am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "10:00",
    "calendarStatus": "available",
    "customerEmail": "katy@gmal.com",
    "pendingUserAction": {
      "type": "booking_confirmation",
      "slot": "Monday 10am",
      "email": "katy@gmal.com"
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

### email_typo_correction_booking / Turn 6

User: Sorry typo: katie@gmail.com

```text
Got it - I updated the email to katie@gmail.com. Want me to lock in 10:00 AM?
```

```json
{
  "extractedSlots": {
    "email": "katie@gmail.com"
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
    "proposedCallTime": "Monday 10am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "10:00",
    "calendarStatus": "available",
    "customerEmail": "katie@gmail.com",
    "pendingUserAction": {
      "type": "booking_confirmation",
      "slot": "Monday 10am",
      "email": "katy@gmal.com"
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

### email_typo_correction_booking / Turn 7

User: Yes

```text
All set for 10:00 AM 🤍

You should get the calendar invite at katie@gmail.com.
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
    "proposedCallTime": "Monday 10am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "10:00",
    "calendarStatus": "available",
    "customerEmail": "katie@gmail.com",
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

### invalid_call_time_then_valid_booking / Turn 1

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

### invalid_call_time_then_valid_booking / Turn 2

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

### invalid_call_time_then_valid_booking / Turn 3

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

### invalid_call_time_then_valid_booking / Turn 4

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

### invalid_call_time_then_valid_booking / Turn 5

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

### invalid_call_time_then_valid_booking / Turn 6

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

### invalid_call_time_then_valid_booking / Turn 7

User: Yes

```text
Perfect — you're all set for 10:00 AM ✨

You should see the calendar invite come through at katie@example.com.
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

### calendar_busy_then_suggested_time_booking / Turn 1

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

### calendar_busy_then_suggested_time_booking / Turn 2

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

### calendar_busy_then_suggested_time_booking / Turn 3

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

### calendar_busy_then_suggested_time_booking / Turn 4

User: Monday at 10am

```text
That time is already taken, but 11:00 AM is open. Would that work for you?
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
    "calendarStatus": "busy",
    "pendingUserAction": null,
    "bookingConfirmed": false
  },
  "toolCalls": [
    "check_consultation_calendar"
  ],
  "nextStep": "reply_only",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### calendar_busy_then_suggested_time_booking / Turn 5

User: 11am works

```text
11:00 AM works on my calendar.

What's the best email for the calendar invite?
```

```json
{
  "extractedSlots": {
    "proposedCallTime": "11am"
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
    "proposedCallTime": "Monday at 11am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "11:00",
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

### calendar_busy_then_suggested_time_booking / Turn 6

User: katie@example.com

```text
Perfect, got it. Want me to lock in 11:00 AM?
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
    "proposedCallTime": "Monday at 11am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "11:00",
    "calendarStatus": "available",
    "customerEmail": "katie@example.com",
    "pendingUserAction": {
      "type": "booking_confirmation",
      "slot": "Monday at 11am",
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

### calendar_busy_then_suggested_time_booking / Turn 7

User: Yes

```text
All set for 11:00 AM 🤍

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
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "The Bradford",
    "proposedCallTime": "Monday at 11am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "11:00",
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

### post_booking_thanks_no_duplicate_booking / Turn 1

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

### post_booking_thanks_no_duplicate_booking / Turn 2

User: Katie and Mike

```text
Love it. What venue are you two planning for?
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

### post_booking_thanks_no_duplicate_booking / Turn 3

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

### post_booking_thanks_no_duplicate_booking / Turn 4

User: Monday 10am

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
    "location": "Raleigh",
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

### post_booking_thanks_no_duplicate_booking / Turn 5

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

### post_booking_thanks_no_duplicate_booking / Turn 6

User: Yes

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

### post_booking_thanks_no_duplicate_booking / Turn 7

User: Thanks, see you then

```text
Of course — talk soon 🤍
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
    "proposedCallTime": "Monday 10am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "10:00",
    "calendarStatus": "available",
    "customerEmail": "katie@example.com",
    "pendingUserAction": null,
    "bookingConfirmed": true
  },
  "toolCalls": [],
  "responseKey": "utter_acknowledgement",
  "nextStep": "reply_only",
  "mode": "bot_active",
  "escalated": false,
  "humanReviewRequired": false,
  "attachments": [],
  "result": "PASS"
}
```

### post_booking_reschedule_request / Turn 1

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

### post_booking_reschedule_request / Turn 2

User: Katie and Mike

```text
Love it. What venue are you two planning for?
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

### post_booking_reschedule_request / Turn 3

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

### post_booking_reschedule_request / Turn 4

User: Monday 10am

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
    "location": "Raleigh",
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

### post_booking_reschedule_request / Turn 5

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

### post_booking_reschedule_request / Turn 6

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
    "location": "Raleigh",
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

### post_booking_reschedule_request / Turn 7

User: Actually can we reschedule?

```text
Totally - I'll have a real person from the team follow up here shortly 🤍
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
    "proposedCallTime": "Monday 10am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "10:00",
    "calendarStatus": "available",
    "customerEmail": "katie@example.com",
    "pendingUserAction": null,
    "bookingConfirmed": true
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

### out_of_region_new_york / Turn 1

User: Wedding in New York on Oct 3 2026

```text
Hi! Thanks so much for reaching out 🤍

I have October 3, 2026 in New York. Our main coverage areas are Florida and NC/SC/GA. Is this a travel wedding, or are you asking about one of those areas?
```

```json
{
  "extractedSlots": {
    "weddingDate": "2026-10-03",
    "weddingDateText": "Oct 3 2026",
    "location": "New York"
  },
  "slotsAfter": {
    "weddingDate": "2026-10-03",
    "weddingDateDisplay": "October 3, 2026",
    "location": "New York",
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

### messy_casual_short_messages / Turn 1

User: yo need video

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

### messy_casual_short_messages / Turn 2

User: oct 3 2026 raleigh

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
    "weddingDateText": "oct 3 2026",
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

### messy_casual_short_messages / Turn 3

User: katie n mike

```text
Love it. What venue are you two planning for?
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

### messy_casual_short_messages / Turn 4

User: bradford

```text
Beautiful - Bradford gives us a good starting point.

From here, the easiest next step is a quick consult so I can hear more about the day. What time works best? I do consults Monday-Friday, 9am-2pm Eastern.
```

```json
{
  "extractedSlots": {
    "venue": "Bradford"
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
    "venue": "Bradford",
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

### messy_casual_short_messages / Turn 5

User: mon 10am

```text
10:00 AM works on my calendar.

What's the best email for the calendar invite?
```

```json
{
  "extractedSlots": {
    "proposedCallTime": "mon 10am"
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
    "venue": "Bradford",
    "proposedCallTime": "mon 10am",
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

### messy_casual_short_messages / Turn 6

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
    "venue": "Bradford",
    "proposedCallTime": "mon 10am",
    "checkedCallDate": "2026-10-05",
    "checkedCallTime": "10:00",
    "calendarStatus": "available",
    "customerEmail": "katie@example.com",
    "pendingUserAction": {
      "type": "booking_confirmation",
      "slot": "mon 10am",
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

### messy_casual_short_messages / Turn 7

User: yeah

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
    "location": "Raleigh",
    "serviceRegion": "NC_SC_GA",
    "availability": "available",
    "availabilityToolStatus": "available",
    "venue": "Bradford",
    "proposedCallTime": "mon 10am",
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

### duplicate_inbound_no_duplicate_guide / Turn 1

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

### duplicate_inbound_no_duplicate_guide / Turn 2

User: Wedding in Raleigh on Oct 3 2026

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

### duplicate_inbound_no_duplicate_guide / Turn 3

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
