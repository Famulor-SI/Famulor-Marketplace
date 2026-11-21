# Text callers who did not book (example)

This folder shows the files of an automation template. The workflow file is an unchanged export from the app.

## What it does

1. **On Call Completed** starts the automation after every call of the chosen assistant.
2. Three filters keep only inbound calls that have a caller number and ended without a booking.
3. The automation waits one minute.
4. **Send SMS** sends the caller your booking link.

## Setup

After using the template, pick the assistant in the trigger, choose the SMS sender and replace `[your booking link]` in the message text.

## How this file was made

In Famulor, open the automation, choose **Export** and save the file as `automation.famulor-automation.json`. The export removes keys, webhook addresses and ids of your workspace.
