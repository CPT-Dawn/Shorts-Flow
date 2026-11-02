# Zero telemetry

Shorts Flow collects nothing and makes no remote calls. Settings and the Session live only in the browser's local storage. The only data that ever leaves the browser is what a viewer chooses to send from the Report Page or the Goodbye Page, which pre-fill a GitHub issue or email with the extension version and browser, and nothing is sent without the viewer pressing send. This keeps the privacy policy one line, lets Firefox declare `data_collection_permissions: none`, and removes a whole class of store-review risk, at the cost of not knowing which features people use.
