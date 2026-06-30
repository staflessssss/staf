# Wedding First-Turn Lead Matrix

Passed: 30/30

| Scenario | User message | Date | Location | Region | Tool | Mode | Next step | Handoff | Escalated | Human review | Response key | Attachments | Guard | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
known_winston_salem_need_videographer | Hii! I need a videographer for a wedding in Winston Salem on Oct 3 2026 | 2026-10-03 | Winston Salem | NC_SC_GA | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS
known_winston_salem_nc_availability | Do you have availability in Winston-Salem NC on Oct 3 2026? | 2026-10-03 | Winston-Salem Nc | NC_SC_GA | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS
known_greensboro | Hi, we're getting married in Greensboro NC on October 3 2026 | 2026-10-03 | Greensboro Nc | NC_SC_GA | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS
known_charlotte | Need a wedding videographer in Charlotte on Oct 3 2026 | 2026-10-03 | Charlotte | NC_SC_GA | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS
known_raleigh | Hi! Wedding in Raleigh NC on October 3rd 2026 | 2026-10-03 | Raleigh Nc | NC_SC_GA | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS
known_savannah | Looking for a videographer in Savannah GA on Oct 3 2026 | 2026-10-03 | Savannah Ga | NC_SC_GA | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS
known_charleston | Wedding in Charleston SC on October 3 2026, are you available? | 2026-10-03 | Charleston Sc | NC_SC_GA | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS
known_tampa | Hi, do you have availability in Tampa FL on Oct 3 2026? | 2026-10-03 | Tampa Fl | FL | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS
known_orlando | I need wedding video in Orlando Florida on October 3 2026 | 2026-10-03 | Orlando Florida | FL | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS
known_st_pete | We're getting married in St Pete on Oct 3 2026 | 2026-10-03 | St Pete | FL | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS
unknown_springfield | I need a videographer in Springfield on Oct 3 2026 | 2026-10-03 | Springfield | unknown |  | bot_active | ask_missing_info |  | no | no | utter_first_turn_lead_region_clarification |  | {"ok":true} | PASS
unknown_portland_travel | Do you travel to Portland for weddings on Oct 3 2026? | 2026-10-03 | Portland | unknown |  | bot_active | ask_missing_info |  | no | no | utter_first_turn_lead_region_clarification |  | {"ok":true} | PASS
unknown_columbus | Wedding in Columbus on Oct 3 2026 | 2026-10-03 | Columbus | unknown |  | bot_active | ask_missing_info |  | no | no | utter_first_turn_lead_region_clarification |  | {"ok":true} | PASS
unknown_washington | We're in Washington on October 3 2026 | 2026-10-03 | Washington | unknown |  | bot_active | ask_missing_info |  | no | no | utter_first_turn_lead_region_clarification |  | {"ok":true} | PASS
unknown_newport | Are you available for Newport on Oct 3 2026? | 2026-10-03 | Newport | unknown |  | bot_active | ask_missing_info |  | no | no | utter_first_turn_lead_region_clarification |  | {"ok":true} | PASS
opener_interested | Hello, I'm interested |  |  | unknown |  | bot_active | ask_missing_info |  | no | no | utter_ask_wedding_details |  | {"ok":true} | PASS
opener_more_information | Can I get more information? |  |  | unknown |  | bot_active | ask_missing_info |  | no | no | utter_ask_wedding_details |  | {"ok":true} | PASS
opener_more_info | More info please |  |  | unknown |  | bot_active | ask_missing_info |  | no | no | utter_ask_wedding_details |  | {"ok":true} | PASS
opener_wedding_videography | Interested in wedding videography |  |  | unknown |  | bot_active | ask_missing_info |  | no | no | utter_ask_wedding_details |  | {"ok":true} | PASS
opener_how_does_this_work | Hi, how does this work? |  |  | unknown |  | bot_active | ask_missing_info |  | no | no | utter_ask_wedding_details |  | {"ok":true} | PASS
team_not_needed_videographer | I need a videographer for my wedding |  |  | unknown |  | bot_active | ask_missing_info |  | no | no | utter_ask_wedding_details |  | {"ok":true} | PASS
team_who_filming | Who will be filming our wedding? |  |  | unknown |  | bot_active | reply_only |  | no | no | utter_ask_wedding_details |  | {"ok":true} | PASS
team_jay_filming | Is Jay the one filming? |  |  | unknown |  | bot_active | reply_only |  | no | no | utter_ask_wedding_details |  | {"ok":true} | PASS
team_on_your_team | Who is on your team? |  |  | unknown |  | bot_active | reply_only |  | no | no | utter_ask_wedding_details |  | {"ok":true} | PASS
team_word_but_availability | Do you have a videographer available for Oct 3 2026 in Tampa? | 2026-10-03 | Tampa | FL | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS
forced_needs_region | I need a videographer in Springfield on Oct 3 2026 | 2026-10-03 | Springfield | unknown | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_first_turn_lead_region_clarification |  | {"ok":true} | PASS
forced_available_winston | Wedding in Winston Salem on Oct 3 2026 | 2026-10-03 | Winston Salem | NC_SC_GA | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS
forced_unavailable_tampa | Wedding in Tampa on Oct 3 2026 | 2026-10-03 | Tampa | FL | check_wedding_availability | bot_active | reply_only |  | no | no | utter_first_turn_lead_unavailable |  | {"ok":true} | PASS
forced_tool_error_raleigh | Wedding in Raleigh on Oct 3 2026 | 2026-10-03 | Raleigh | NC_SC_GA | check_wedding_availability | bot_active | ask_missing_info |  | no | yes | utter_first_turn_lead_tool_check | pricing_guide | {"ok":true} | PASS
llm_bad_team_override | I need a videographer in Winston Salem on Oct 3 2026 | 2026-10-03 | Winston Salem | NC_SC_GA | check_wedding_availability | bot_active | ask_missing_info |  | no | no | utter_availability_available_ask_names | pricing_guide | {"ok":true} | PASS

## Outbound Text

### known_winston_salem_need_videographer

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Winston Salem 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

### known_winston_salem_nc_availability

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Winston-Salem Nc 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

### known_greensboro

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Greensboro Nc 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

### known_charlotte

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Charlotte 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

### known_raleigh

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Raleigh Nc 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

### known_savannah

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Savannah Ga 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

### known_charleston

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Charleston Sc 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

### known_tampa

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Tampa Fl 🤍

Our 8-hour wedding films start at $2,800 for Florida.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

### known_orlando

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Orlando Florida 🤍

Our 8-hour wedding films start at $2,800 for Florida.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

### known_st_pete

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in St Pete 🤍

Our 8-hour wedding films start at $2,800 for Florida.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

### unknown_springfield

```text
Hi! Thanks so much for reaching out 🤍

I have October 3, 2026 in Springfield. Our main coverage areas are Florida and NC/SC/GA. Is this a travel wedding, or are you asking about one of those areas?
```

### unknown_portland_travel

```text
Hi! Thanks so much for reaching out 🤍

I have October 3, 2026 in Portland. Our main coverage areas are Florida and NC/SC/GA. Is this a travel wedding, or are you asking about one of those areas?
```

### unknown_columbus

```text
Hi! Thanks so much for reaching out 🤍

I have October 3, 2026 in Columbus. Our main coverage areas are Florida and NC/SC/GA. Is this a travel wedding, or are you asking about one of those areas?
```

### unknown_washington

```text
Hi! Thanks so much for reaching out 🤍

I have October 3, 2026 in Washington. Our main coverage areas are Florida and NC/SC/GA. Is this a travel wedding, or are you asking about one of those areas?
```

### unknown_newport

```text
Hi! Thanks so much for reaching out 🤍

I have October 3, 2026 in Newport. Our main coverage areas are Florida and NC/SC/GA. Is this a travel wedding, or are you asking about one of those areas?
```

### opener_interested

```text
Hi! So happy you reached out 🤍 What wedding date and city are you planning for?
```

### opener_more_information

```text
Hi! So happy you reached out 🤍 What wedding date and city are you planning for?
```

### opener_more_info

```text
Hi! So happy you reached out 🤍 What wedding date and city are you planning for?
```

### opener_wedding_videography

```text
Hi! So happy you reached out 🤍 What wedding date and city are you planning for?
```

### opener_how_does_this_work

```text
Hi! So happy you reached out 🤍 What wedding date and city are you planning for?
```

### team_not_needed_videographer

```text
Hi, happy you’re here 🤍 What date and location are you thinking for the wedding?
```

### team_who_filming

```text
Hi! Thanks so much for reaching out 🤍

Taras with Myndful Films. I’d love to help with the wedding film.

The exact filmmaker depends on the wedding location and availability.

What wedding date and city are you planning for?
```

### team_jay_filming

```text
Hi! Thanks so much for reaching out 🤍

Taras with Myndful Films. I’d love to help with the wedding film.

The exact filmmaker depends on the wedding location and availability.

What wedding date and city are you planning for?
```

### team_on_your_team

```text
Hi! Thanks so much for reaching out 🤍

Taras with Myndful Films. I’d love to help with the wedding film.

The exact filmmaker depends on the wedding location and availability.

What wedding date and city are you planning for?
```

### team_word_but_availability

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Tampa 🤍

Our 8-hour wedding films start at $2,800 for Florida.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

### forced_needs_region

```text
Hi! Thanks so much for reaching out 🤍

I have October 3, 2026 in Springfield. Our main coverage areas are Florida and NC/SC/GA. Is this a travel wedding, or are you asking about one of those areas?
```

### forced_available_winston

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Winston Salem 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```

### forced_unavailable_tampa

```text
Hi! Thanks so much for reaching out 🤍

October 3, 2026 in Tampa is not open for us.

Our 8-hour wedding films start at $2,800 for Florida.
```

### forced_tool_error_raleigh

```text
Hi! Thanks so much for reaching out 🤍

I have October 3, 2026 in Raleigh. I’m having trouble checking availability right this second, so I don’t want to guess.

Our 8-hour wedding films start at $3,600 for NC/SC/GA, and I’ll send the collections guide here too 🎥

I’ll have the date checked and follow up shortly. In the meantime, what are both of your names?
```

### llm_bad_team_override

```text
Hi! Thanks so much for reaching out 🤍 Taras with Myndful Films. I’d love to help with the wedding film.

Great news — October 3, 2026 is available in Winston Salem 🤍

Our 8-hour wedding films start at $3,600 for NC/SC/GA.

I’ll send the collections guide here so you can look through the options 🎥

What are both of your names?
```
