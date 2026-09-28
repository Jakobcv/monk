---
{"id":"e8e9e5c8-bbec-4f40-9004-97027c143118","title":"Undo clearing a list","status":"shipped","owner":"Sofia","initiativeId":null,"openQuestions":[],"acceptanceCriteria":[{"text":"Given a list with items, when Clear list is chosen, the list empties and an Undo shows for ten seconds.","checked":true},{"text":"Given the Undo, when it is chosen, every cleared item is back, ticked or not as it was.","checked":true},{"text":"Given a list cleared on one phone, when Undo is chosen there, the items come back on the other member's phone too.","checked":true}],"createdAt":"2026-07-20T12:00:00.000Z","updatedAt":"2026-08-04T12:00:00.000Z"}
---
## Problem
Clear ticked items sits next to Clear list, and a mis-tap on the second deletes a whole week's list with no way back. Support hears about it about twice a week.

## Goals
- Clearing a list can be undone for long enough to notice.

## Non-goals
- A history of past lists.
- Undo for anything other than clearing.