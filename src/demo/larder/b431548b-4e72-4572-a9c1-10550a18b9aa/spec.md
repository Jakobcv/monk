---
{"id":"b431548b-4e72-4572-a9c1-10550a18b9aa","title":"Send the week's plan to the list","status":"active","owner":"Priya","initiativeId":"a860d9ca-7144-4dc6-af31-7e3ab9e5fc3f","researchPlanIds":["09e5ffb5-e62b-43d2-b92f-c49846a9f240"],"openQuestions":[{"text":"When the same ingredient comes in different units — a tin and 400 g — are they added together or listed apart?","checked":false},{"text":"Does sending a plan twice add its ingredients twice?","checked":true,"resolution":"No. Sending again updates what the plan added last time and leaves anything typed by hand alone."}],"acceptanceCriteria":[{"text":"Given a week's plan with three meals, when Send to list is chosen, every ingredient of the three meals is on the list.","checked":true},{"text":"Given two meals that each need one onion, when the plan is sent, the list has one item for two onions.","checked":false},{"text":"Given a meal planned for two from a recipe for four, when the plan is sent, its quantities are halved.","checked":false},{"text":"Given a plan already sent, when a meal is removed and the plan is sent again, that meal's ingredients leave the list and items typed by hand stay.","checked":false}],"createdAt":"2026-09-14T12:00:00.000Z","updatedAt":"2026-09-28T00:00:00.000Z"}
---
## Problem
A household that plans its week in Larder then copies every ingredient onto the list by hand, and most stop planning because of it: only 12% of households that plan add any of the plan's ingredients to a list the same week, and 63% of planners call the copying the most tedious part.

## Goals
- A planner turns a week's plan into list items in one step.
- The same ingredient across several meals arrives as one item with its quantities added together.
- Sending a plan again after changing it updates the list rather than doubling it.

## Non-goals
- Leaving off what the household already has. That is Leave pantry staples off the list.
- Choosing which shop an item comes from.
- Recipes from outside Larder.