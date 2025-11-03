1. use formlink/runtime in formfiller, remove redundantant code.
2. in formlink/runtime create a <LinkWithFormlink formId={formId} schema={schema} brachingLogic={branchingLogic}/> button.
   - tries to establish a connnection with this formid to formlink, if not found show a connect with formlink button in UI
   - on every load in dev env it should try to do a request on formlink check if form exist and schema has not changed. if it has it should show schema mismatch etc and update button.
   - it basically should be smart, should try to avoid backend request and only trigger backend request when can't figure out, maybe storing in localstorage when first linkwithformlink button is clicked or having a proxy on schema(won't help when code source changes)
   - it should also make sure formId in code source doesn't change
   - formlink/runtime should be aware if code genration is on other platform or it is used by formlink itself to avoid this button in formcraft
3. current form generation should generate branching logic based on new branching system.
4. formcraft should be aware if UI is hosted outside or not, if(form created via linkedwithformlink button from outside or via chat in app) based on it should show preview in in iframe of ours or their, should disable form schema udpate agent
