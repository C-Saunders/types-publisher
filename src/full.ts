import * as yargs from "yargs";

import appInsights = require("applicationinsights");
import { Fetcher } from "./util/io";
import calculateVersions from "./calculate-versions";
import clean from "./clean";
import createSearchIndex from "./create-search-index";
import generatePackages from "./generate-packages";
import { getDefinitelyTyped } from "./get-definitely-typed";
import { Options } from "./lib/common";
import { UncachedNpmInfoClient } from "./lib/npm-client";
import parseDefinitions from "./parse-definitions";
import publishPackages from "./publish-packages";
import publishRegistry from "./publish-registry";
import uploadBlobsAndUpdateIssue from "./upload-blobs";
import { assertDefined, currentTimeStamp, logUncaughtErrors, numberOfOsProcesses } from "./util/util";
import validate from "./validate";

if (!module.parent) {
    appInsights.setup();
    appInsights.start();
    const dry = !!yargs.argv.dry;
    logUncaughtErrors(full(dry, currentTimeStamp(), process.env["GH_API_TOKEN"] || "", new Fetcher(), Options.defaults));
}

export default async function full(dry: boolean, timeStamp: string, githubAccessToken: string, fetcher: Fetcher, options: Options): Promise<void> {
    const infoClient = new UncachedNpmInfoClient();
    await clean();
    const dt = await getDefinitelyTyped(options);
    const allPackages = await parseDefinitions(dt, options.parseInParallel
            ? { nProcesses: numberOfOsProcesses, definitelyTypedPath: assertDefined(options.definitelyTypedPath) }
            : undefined);
    const changedPackages = await calculateVersions(dt, infoClient);
    await generatePackages(dt, allPackages, changedPackages);
    await createSearchIndex(allPackages, infoClient);
    await publishPackages(changedPackages, dry, githubAccessToken, fetcher);
    await publishRegistry(dt, allPackages, dry, infoClient);
    await validate(dt);
    if (!dry) {
        await uploadBlobsAndUpdateIssue(timeStamp);
    }
}
