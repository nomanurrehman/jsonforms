/// <reference path="../../typings/angularjs/angular.d.ts"/>
/// <reference path="../../typings/ui-grid/ui-grid.d.ts"/>
/// <reference path="../services.ts"/>

class ArrayControl implements JSONForms.IRenderer {


    private maxSize = 99;

    priority = 2;

    constructor(private pathResolver: JSONForms.IPathResolver, private scope: ng.IScope) {

    }

    isApplicable(element: IUISchemaElement, subSchema: SchemaElement, schemaPath: string):boolean {
        return element.type == 'Control' && subSchema !== undefined && subSchema.type == 'array';
    }

    render(element: IControlObject, schema: SchemaElement, schemaPath: string, dataProvider: JSONForms.IDataProvider): JSONForms.IRenderDescription {

        var control = this.createTableUIElement(element, dataProvider, schema, schemaPath);

        var data;
        if (dataProvider.data instanceof Array) {
            data = dataProvider.data;
        } else {
            data = this.pathResolver.resolveInstance(dataProvider.data, this.pathResolver.toInstancePath(schemaPath));
        }

        if (data === undefined || data.length == 0) {
            dataProvider.fetchData().then(function(response) {
                control['tableOptions'].gridOptions.data = response.slice(
                    dataProvider.page * dataProvider.pageSize,
                    dataProvider.page * dataProvider.pageSize + dataProvider.pageSize);
            });
        }

        if (data != undefined) {
            control['tableOptions'].gridOptions.data = data.slice(
                dataProvider.page * dataProvider.pageSize,
                dataProvider.page * dataProvider.pageSize + dataProvider.pageSize);
        }

        control['tableOptions'].gridOptions['paginationPage'] = dataProvider.page;
        control['tableOptions'].gridOptions['paginationPageSize'] = dataProvider.pageSize;
        control['tableOptions'].gridOptions.enableHorizontalScrollbar = 0; // TODO uiGridConstants.scrollbars.NEVER;
        control['tableOptions'].gridOptions.enableVerticalScrollbar = 0; // TODO uiGridConstants.scrollbars.NEVER;


        var o = {
            "type": "Control",
            "size": this.maxSize,
            "template": `<control><div ui-grid="element['gridOptions']" ui-grid-auto-resize ui-grid-pagination class="grid"></div></control>`
        };
        o["gridOptions"] = control['tableOptions']['gridOptions'];
        return o;
    }

    private createColDefs(columnDescriptions: any): uiGrid.IColumnDef[] {
        return columnDescriptions.map((col, idx) => {
            var href = col.href;
            if (href) {
                var hrefScope = href.scope;
                var cellTemplate;
                var field = this.pathResolver.toInstancePath(col['scope']['$ref']);

                if (hrefScope) {
                    var instancePath = this.pathResolver.toInstancePath(hrefScope.$ref);
                    cellTemplate = `<div class="ui-grid-cell-contents">
                      <a href="#${href.url}/{{row.entity.${instancePath}}}">
                        {{row.entity.${field}}}
                      </a>
                    </div>`;
                } else {
                    cellTemplate = `<div class="ui-grid-cell-contents">
                      <a href="#${href.url}/{{row.entity.${field}}}">
                        {{row.entity.${field}}}
                      </a>
                </div>`;
                }

                var r: uiGrid.IColumnDef = {
                    cellTemplate: cellTemplate,
                    field: field,
                    displayName: col.label
                };
                return r;
            } else {
                var r: uiGrid.IColumnDef = {
                    field: this.pathResolver.toInstancePath(col['scope']['$ref']),
                    displayName: col.label
                };
                return r;
            }
        });
    }

    private generateColDefs(schema: SchemaElement, schemaPath: string): any {
        var colDefs = [];
        var subSchema = this.pathResolver.resolveSchema(schema, schemaPath);
        var items = subSchema['items'];
        // TODO: items
        if (items['type'] == 'object') {
            for (var prop in items['properties']) {
                if (items['properties'].hasOwnProperty(prop)) {
                    var colDef = {
                        field: prop,
                        displayName: JSONForms.PathUtil.beautify(prop)
                    };
                    colDefs.push(colDef);
                }
            }
        } else {
            // TODO is this case even possible?
        }

        return colDefs;
    }

    private createTableUIElement(element, dataProvider: JSONForms.IDataProvider, schema: SchemaElement, schemaPath: string) {

        // TODO: how to configure paging/filtering
        var paginationEnabled = dataProvider.fetchPage !== undefined;
        var filteringEnabled = false;

        var uiElement = { schemaType: "array" };

        var colDefs;
        // TODO: change semantics of the columns attribute to only show selected properties
        if (element.columns) {
            colDefs = this.createColDefs(element.columns);
        } else {
            colDefs = this.generateColDefs(schema, schemaPath);
        }

        var tableOptions = {
            columns: element.columns,
            gridOptions: {
                enableFiltering: filteringEnabled,
                enablePaginationControls: paginationEnabled,
                enableColumnResizing: true,
                enableAutoResize: true,
                // TODO: make cell clickable somehow
                columnDefs: colDefs,
                data: [],
                useExternalFiltering: true
            }
        };

        if (paginationEnabled) {
            tableOptions['gridOptions']['enablePagination'] = paginationEnabled;
            tableOptions['gridOptions']['useExternalPagination'] = true;
            // TODO: dummies
            tableOptions['gridOptions']['paginationPageSizes'] = [1,2,3,4,5];
            tableOptions['gridOptions']['paginationPageSize'] = 1;
            tableOptions['gridOptions']['paginationPage'] = 1;
        }

        if (dataProvider.totalItems) {
            tableOptions['gridOptions']['totalItems'] = dataProvider.totalItems;
        }

        // TODO:
        //var firstColumnDef = tableOptions.gridOptions.columnDefs[0];
        //firstColumnDef.cellTemplate = firstColumnDef.cellTemplate.replace("<<TYPE>>", path);

        // convenience methods --
        uiElement['enablePaginationControls'] = function() {
            tableOptions.gridOptions.enablePaginationControls = true;
        };
        uiElement['disablePaginationControls'] = function() {
            tableOptions.gridOptions.enablePaginationControls = false;
        };


        tableOptions.gridOptions['onRegisterApi'] = (gridApi) => {
            //gridAPI = gridApi;
            gridApi.pagination.on.paginationChanged(this.scope, function (newPage, pageSize) {
                tableOptions.gridOptions['paginationPage'] = newPage;
                tableOptions.gridOptions['paginationPageSize'] = pageSize;
                dataProvider.setPageSize(pageSize);
                dataProvider.fetchPage(newPage, pageSize).then(newData => {
                    tableOptions.gridOptions.data = newData;
                });
            });
        } ;
        uiElement['tableOptions'] = tableOptions;

        return uiElement;
    }

    findSearchTerms(grid) {
        var searchTerms = [];
        for (var i = 0; i < grid.columns.length; i++) {
            var searchTerm = grid.columns[i].filters[0].term;
            if (searchTerm !== undefined && searchTerm !== null) {
                searchTerms.push({
                    column: grid.columns[i].name,
                    term: searchTerm
                });
            }
        }

        return searchTerms;
    }
}

var app = angular.module('jsonforms.arrayControl', []);

app.run(['RenderService', 'PathResolver', '$rootScope', (RenderService, PathResolver, $rootScope) => {
    RenderService.register(new ArrayControl(PathResolver, $rootScope));
}]);