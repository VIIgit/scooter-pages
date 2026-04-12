/**
 * DivTable - A modern table widget using CSS Grid and Flexbox instead of HTML tables
 * Provides the same functionality as SmartTable but with a more flexible div-based layout
 */
class DivTable {
  constructor(monaco, options) {
    this.monaco = monaco;
    this.options = options;
    
    // Check if data was explicitly provided (even if empty array)
    const hasExplicitData = options.data !== undefined && options.data !== null;
    this.data = hasExplicitData ? options.data : [];
    
    this.columns = options.columns || [];
    
    // Check for deprecated subLabel/subField/subType/subRender properties
    this.columns.forEach(col => {
      if (col.subLabel || col.subField || col.subType || col.subRender) {
        console.warn(
          `DivTable: Column '${col.field}' uses deprecated properties (subLabel, subField, subType, subRender). ` +
          `Please migrate to fieldCompositeName approach. See README for migration guide.`
        );
      }
    });
    
    this.showCheckboxes = options.showCheckboxes !== false;
    this.multiSelect = options.multiSelect !== false;
    this.onSelectionChange = options.onSelectionChange || (() => {});
    this.onRowFocus = options.onRowFocus || (() => {});
    
    // Group collapse option: controls whether groups start collapsed (default: true for backward compat)
    this.groupCollapsed = options.groupCollapsed !== false;
    
    // Custom group header render function
    this.groupRender = options.groupRender || null;
    
    // Loading placeholder option
    this.showLoadingPlaceholder = options.showLoadingPlaceholder !== false;
    this.isLoadingState = this.data.length === 0 && this.showLoadingPlaceholder; // Show loading when no initial data and enabled
    
    // Store whether we need to load first page automatically
    this._shouldLoadFirstPage = !hasExplicitData && typeof options.onNextPage === 'function';
    
    // Refresh button options
    this.showRefreshButton = options.showRefreshButton || false;
    this.onRefresh = options.onRefresh || (() => {});
    
    // Auto-fetch options
    this.showAutoFetchButton = options.showAutoFetchButton !== false; // Enabled by default
    this.autoFetchDelay = options.autoFetchDelay || 500; // Delay between auto-fetch requests in ms
    
    // Virtual scrolling options
    this.virtualScrolling = options.virtualScrolling || false;
    this.pageSize = options.pageSize || 100;
    // If totalRecords not provided and virtual scrolling is enabled, assume 10x page size for progress bar animation
    this.totalRecords = options.totalRecords || (this.virtualScrolling ? this.pageSize * 10 : this.data.length);
    this.onNextPage = options.onNextPage || (() => {});
    this.onPreviousPage = options.onPreviousPage || (() => {});
    this.loadingThreshold = options.loadingThreshold || Math.floor(this.pageSize * 0.8); // Default: 80% of page size
    this.scrollThreshold = options.scrollThreshold || 0.95; // Fallback for percentage-based logic
    
    // Internal state
    this.filteredData = [...this.data];
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.sortMode = 'value'; // 'value' for alphabetical, 'count' for count-based sorting (only used for grouped fields)
    this.groupByField = null;
    this.collapsedGroups = new Set();
    this.selectedRows = new Set();
    this.focusedRowId = null;
    this.currentQuery = '';
    this._lastFocusCallback = { rowId: null, groupKey: null }; // Track last focus callback to prevent duplicates
    this.showOnlySelected = false; // Filter toggle state
    
    // Virtual scrolling state
    this.currentPage = 0;
    this.isLoading = false;
    this.hasMoreData = true;
    this.estimatedRowHeight = 40; // Default row height for calculations
    this.visibleStartIndex = 0;
    this.visibleEndIndex = this.pageSize;
    
    // Auto-fetch state
    this.isAutoFetching = false;
    this.autoFetchPaused = false;
    this.autoFetchTimeout = null;
    
    // Fixed columns option (frozen left columns)
    this.fixedColumns = options.fixedColumns || 0;
    
    // Lazy cell rendering option (for performance optimization)
    this.lazyCellRendering = options.lazyCellRendering !== false; // Enabled by default
    this.lazyRenderMargin = options.lazyRenderMargin || '200px'; // Pre-render rows slightly before visible
    this.rowObserver = null; // IntersectionObserver for lazy rendering
    
    // Aggregate summary row options
    // Header summary shows totals for entire dataset (grand total)
    // Group summary shows totals per group when data is grouped
    this.showHeaderSummary = options.showHeaderSummary || false;
    this.showGroupSummary = options.showGroupSummary || false;
    
    // Find primary key field first
    this.primaryKeyField = this.columns.find(col => col.primaryKey)?.field || 'id';
    
    // Initialize QueryEngine like in smart-table with primary key field
    this.queryEngine = new QueryEngine(this.data, this.primaryKeyField);
    
    // Initialize the widget
    this.init();

    // Apply initial grouping if specified
    if (options.group) {
      this.group(options.group);
    }

    // Apply initial sorting if specified
    if (options.sort && options.sort.field) {
      this.sort(options.sort.field, options.sort.direction);
    }
  }

  /**
   * Strip HTML tags from a string for use in tooltips
   * @param {string} html - String potentially containing HTML
   * @returns {string} Plain text without HTML tags
   */
  stripHtmlTags(html) {
    if (!html) return '';
    // Replace <br> and <br/> with space, then strip all other HTML tags
    return String(html)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  init() {
    const container = this.options.tableWidgetElement;
    if (!container) {
      console.error('DivTable: tableWidgetElement is required');
      return;
    }

    // Set up container classes
    if (!this.showCheckboxes) {
      container.classList.add('no-checkboxes');
    }
    if (!this.multiSelect) {
      container.classList.add('no-multiselect');
    }

    // Create the table structure
    this.createTableStructure(container);
    
    // Set up query editor
    this.setupQueryEditor();
    
    // Initial render
    this.render();
    
    // Set up keyboard navigation
    this.setupKeyboardNavigation();
    
    // Auto-load first page if no data was provided but onNextPage is available
    // Use setTimeout to ensure the constructor has returned and variable assignment is complete
    if (this._shouldLoadFirstPage) {
      setTimeout(() => this.loadFirstPageAutomatically(), 100);
    } else if (this.virtualScrolling && this.data.length < this.totalRecords && typeof this.onNextPage === 'function') {
      // If virtual scrolling is enabled with initial data but more data is available,
      // automatically trigger loading the next page to show progress bar animation
      setTimeout(() => this.loadNextPage(), 100);
    }
  }

  async loadFirstPageAutomatically() {
    try {
      // Set loading state before fetching data
      this.isLoading = true;
      this.updateInfoSection();
      
      const firstPageData = await this.onNextPage(0, this.pageSize);
      
      // Clear loading state
      this.isLoading = false;
      
      if (firstPageData && Array.isArray(firstPageData) && firstPageData.length > 0) {
        this.replaceData(firstPageData);
      } else {
        // No data returned
        this.isLoadingState = false;
        this.hasMoreData = false;
        this.render();
      }
    } catch (error) {
      console.error('❌ Error loading first page:', error);
      this.isLoading = false;
      this.isLoadingState = false;
      this.hasMoreData = false;
      this.render();
    }
  }

  getOrderedColumns() {
    // Filter out hidden columns first
    let visibleColumns = this.columns.filter(col => !col.hidden);
    
    if (!this.groupByField) {
      return visibleColumns;
    }
    
    // When grouping, move the grouped column to first position (after checkbox)
    const orderedColumns = [...visibleColumns];
    const groupedColumnIndex = orderedColumns.findIndex(col => col.field === this.groupByField);
    
    if (groupedColumnIndex > 0) {
      // Remove the grouped column from its current position
      const [groupedColumn] = orderedColumns.splice(groupedColumnIndex, 1);
      // Insert it at position 0 (first visible column after checkbox)
      orderedColumns.unshift(groupedColumn);
    }
    
    return orderedColumns;
  }

  getCompositeColumns() {
    // Group columns by fieldCompositeName to create composite cells
    // Returns an array of objects: { compositeName, columns: [...] }
    const orderedColumns = this.getOrderedColumns();
    const compositeMap = new Map();
    const result = [];
    
    orderedColumns.forEach(col => {
      if (col.fieldCompositeName) {
        // This column is part of a composite
        if (!compositeMap.has(col.fieldCompositeName)) {
          const composite = {
            compositeName: col.fieldCompositeName,
            columns: []
          };
          compositeMap.set(col.fieldCompositeName, composite);
          result.push(composite);
        }
        compositeMap.get(col.fieldCompositeName).columns.push(col);
      } else {
        // Regular standalone column
        result.push({
          compositeName: null,
          columns: [col]
        });
      }
    });
    
    return result;
  }

  getAllColumns() {
    // Returns all columns including hidden ones - useful for data operations
    return this.columns;
  }

  createTableStructure(container) {
    // Find or create toolbar
    this.toolbar = container.querySelector('.div-table-toolbar');
    if (!this.toolbar) {
      this.toolbar = document.createElement('div');
      this.toolbar.className = 'div-table-toolbar';
      container.appendChild(this.toolbar);
    }

    // Create toolbar elements if they don't exist
    this.createToolbarElements();

    // Create main table container
    this.tableContainer = document.createElement('div');
    this.tableContainer.className = 'div-table-container';
    container.appendChild(this.tableContainer);

    // Check if we need fixed columns layout
    if (this.fixedColumns > 0) {
      this.tableContainer.classList.add('has-fixed-columns');
      this.createFixedColumnsStructure();
    } else {
      // Standard layout without fixed columns
      // Create header
      this.headerContainer = document.createElement('div');
      this.headerContainer.className = 'div-table-header';
      this.tableContainer.appendChild(this.headerContainer);

      // Create body
      this.bodyContainer = document.createElement('div');
      this.bodyContainer.className = 'div-table-body';
      this.tableContainer.appendChild(this.bodyContainer);
    }

    // Set up scroll shadow effect
    this.setupScrollShadow();
  }

  createFixedColumnsStructure() {
    // Create wrapper for horizontal layout
    this.columnsWrapper = document.createElement('div');
    this.columnsWrapper.className = 'div-table-columns-wrapper';
    this.tableContainer.appendChild(this.columnsWrapper);

    // Create fixed (frozen) section
    this.fixedSection = document.createElement('div');
    this.fixedSection.className = 'div-table-fixed-section';
    this.columnsWrapper.appendChild(this.fixedSection);

    // Fixed header
    this.fixedHeaderContainer = document.createElement('div');
    this.fixedHeaderContainer.className = 'div-table-header div-table-fixed-header';
    this.fixedSection.appendChild(this.fixedHeaderContainer);

    // Fixed body
    this.fixedBodyContainer = document.createElement('div');
    this.fixedBodyContainer.className = 'div-table-body div-table-fixed-body';
    this.fixedSection.appendChild(this.fixedBodyContainer);

    // Create scrollable section
    this.scrollSection = document.createElement('div');
    this.scrollSection.className = 'div-table-scroll-section';
    this.columnsWrapper.appendChild(this.scrollSection);

    // Scrollable header
    this.scrollHeaderContainer = document.createElement('div');
    this.scrollHeaderContainer.className = 'div-table-header div-table-scroll-header';
    this.scrollSection.appendChild(this.scrollHeaderContainer);

    // Scrollable body
    this.scrollBodyContainer = document.createElement('div');
    this.scrollBodyContainer.className = 'div-table-body div-table-scroll-body';
    this.scrollSection.appendChild(this.scrollBodyContainer);

    // For compatibility, set headerContainer and bodyContainer to scrollable section
    // (used by some methods that don't know about fixed columns)
    this.headerContainer = this.scrollHeaderContainer;
    this.bodyContainer = this.scrollBodyContainer;

    // Set up scroll synchronization between fixed and scrollable body
    this.setupFixedColumnsScrollSync();
  }

  setupFixedColumnsScrollSync() {
    let isSyncingScroll = false;

    // Sync vertical scroll between fixed body and scrollable body
    // Sync horizontal scroll between scrollable body and header
    this.scrollBodyContainer.addEventListener('scroll', () => {
      if (isSyncingScroll) return;
      isSyncingScroll = true;
      
      // Sync vertical scroll with fixed body
      this.fixedBodyContainer.scrollTop = this.scrollBodyContainer.scrollTop;
      
      // Sync horizontal scroll with scroll header
      this.scrollHeaderContainer.scrollLeft = this.scrollBodyContainer.scrollLeft;
      
      requestAnimationFrame(() => { isSyncingScroll = false; });
    });

    this.fixedBodyContainer.addEventListener('scroll', () => {
      if (isSyncingScroll) return;
      isSyncingScroll = true;
      this.scrollBodyContainer.scrollTop = this.fixedBodyContainer.scrollTop;
      requestAnimationFrame(() => { isSyncingScroll = false; });
    });

    // Sync horizontal scroll from header to body
    this.scrollHeaderContainer.addEventListener('scroll', () => {
      if (isSyncingScroll) return;
      isSyncingScroll = true;
      this.scrollBodyContainer.scrollLeft = this.scrollHeaderContainer.scrollLeft;
      requestAnimationFrame(() => { isSyncingScroll = false; });
    });
    
    // Adjust fixed body padding for horizontal scrollbar height
    this.adjustFixedBodyForHorizontalScrollbar();
    
    // Re-adjust on window resize
    window.addEventListener('resize', () => {
      this.adjustFixedBodyForHorizontalScrollbar();
    });
  }
  
  /**
   * Adjust fixed body padding to account for horizontal scrollbar in scroll body
   * This prevents row misalignment at the bottom when scrolled to the end
   */
  adjustFixedBodyForHorizontalScrollbar() {
    if (!this.fixedBodyContainer || !this.scrollBodyContainer) return;
    
    // Calculate horizontal scrollbar height
    const scrollbarHeight = this.scrollBodyContainer.offsetHeight - this.scrollBodyContainer.clientHeight;
    
    // Add padding to fixed body to compensate for scrollbar
    if (scrollbarHeight > 0) {
      this.fixedBodyContainer.style.paddingBottom = `${scrollbarHeight}px`;
    } else {
      this.fixedBodyContainer.style.paddingBottom = '';
    }
  }

  getEffectiveFixedColumnCount() {
    // Returns the effective number of fixed columns including checkbox if enabled
    // fixedColumns refers to the number of DATA columns to fix
    // Checkbox is always part of the fixed section if showCheckboxes is true
    return this.fixedColumns;
  }

  splitColumnsForFixedLayout() {
    // Split composite columns into fixed and scrollable groups
    const compositeColumns = this.getCompositeColumns();
    const effectiveFixed = this.getEffectiveFixedColumnCount();
    
    const fixedColumns = compositeColumns.slice(0, effectiveFixed);
    const scrollColumns = compositeColumns.slice(effectiveFixed);
    
    return { fixedColumns, scrollColumns };
  }

  createToolbarElements() {
    // Create query input container if it doesn't exist
    let queryContainer = this.toolbar.querySelector('.query-input-container');
    if (!queryContainer) {
      queryContainer = document.createElement('div');
      queryContainer.className = 'query-input-container';
      queryContainer.setAttribute('tabindex', '0');
      this.toolbar.appendChild(queryContainer);
    }


    // Create info section if it doesn't exist
    let infoSection = this.toolbar.querySelector('.info-section');
    if (!infoSection) {
      infoSection = document.createElement('div');
      infoSection.className = 'info-section';
      this.toolbar.appendChild(infoSection);
    }

    // Store references
    this.infoSection = infoSection;
  }

  setupScrollShadow() {
    // For fixed columns layout, use the scroll body container
    const scrollContainer = this.fixedColumns > 0 ? this.scrollBodyContainer : this.bodyContainer;
    const headerContainer = this.fixedColumns > 0 ? this.scrollHeaderContainer : this.headerContainer;
    
    scrollContainer.addEventListener('scroll', () => {
      if (scrollContainer.scrollTop > 0) {
        headerContainer.classList.add('scrolled');
        // Also update fixed header if present
        if (this.fixedColumns > 0 && this.fixedHeaderContainer) {
          this.fixedHeaderContainer.classList.add('scrolled');
        }
      } else {
        headerContainer.classList.remove('scrolled');
        if (this.fixedColumns > 0 && this.fixedHeaderContainer) {
          this.fixedHeaderContainer.classList.remove('scrolled');
        }
      }
      
      // Handle virtual scrolling if enabled
      if (this.virtualScrolling && !this.isLoading) {
        this.handleVirtualScroll();
      }
    });
  }

  setupQueryEditor() {
    const queryContainer = this.toolbar.querySelector('.query-input-container');
    if (!queryContainer) return;

    queryContainer.className = 'query-input-container query-inputfield';
    
    // Set up Monaco editor for query input with proper field type analysis like smart-table
    const fieldNames = {};
    
    // Create a map of column definitions by field for easy lookup
    const columnMap = new Map();
    this.columns.forEach(col => {
      if (col.field) {
        columnMap.set(col.field, col);
      }
    });
    
    if (this.data.length > 0) {
      const sampleItem = this.data[0];
      const processedFields = new Set(); // Track processed fields to avoid duplicates
      
      Object.keys(sampleItem).forEach(field => {
        // Skip if already processed
        if (processedFields.has(field)) {
          return;
        }
        
        // Only process fields that are defined in columns
        const col = columnMap.get(field);
        if (!col) {
          return; // Skip computed or extra fields not in column definitions
        }
        
        // Skip hidden columns
        if (col.hidden) {
          return;
        }
        
        processedFields.add(field);
        
        // Use column type if defined, otherwise infer from data
        let fieldType;
        if (col.type) {
          fieldType = col.type;
        } else {
          fieldType = typeof sampleItem[field] === 'boolean' ? 'boolean'
            : typeof sampleItem[field] === 'number' ? 'number'
              : 'string';
        }

        let fieldValues;
        if (fieldType === 'string') {
          // Collect all values, flattening arrays
          const allValues = [];
          this.data.forEach(item => {
            const value = item[field];
            if (Array.isArray(value)) {
              // Flatten array values
              allValues.push(...value);
            } else {
              allValues.push(value);
            }
          });
          const uniqueValues = [...new Set(allValues)];
          
          const definedValues = uniqueValues.filter(value =>
            value !== null && value !== undefined && value !== ''
          );
          const hasUndefinedValues = uniqueValues.some(value =>
            value === null || value === undefined || value === ''
          );
          fieldValues = hasUndefinedValues
            ? [...definedValues, 'NULL']
            : definedValues;
        }
        fieldNames[field] = { type: fieldType, values: fieldValues };
      });
      
      // Also add subFields from composite columns
      this.columns.forEach(col => {
        if (col.subField && !col.hidden && sampleItem[col.subField] !== undefined) {
          const field = col.subField;
          
          // Skip if already processed
          if (processedFields.has(field)) {
            return;
          }
          processedFields.add(field);
          
          // Use column type if defined, otherwise infer from data
          let fieldType;
          if (col.subType) {
            fieldType = col.subType;
          } else {
            fieldType = typeof sampleItem[field] === 'boolean' ? 'boolean'
              : typeof sampleItem[field] === 'number' ? 'number'
                : 'string';
          }

          let fieldValues;
          if (fieldType === 'string') {
            // Collect all values, flattening arrays
            const allValues = [];
            this.data.forEach(item => {
              const value = item[field];
              if (Array.isArray(value)) {
                // Flatten array values
                allValues.push(...value);
              } else {
                allValues.push(value);
              }
            });
            
            // Get unique values
            const uniqueValues = [...new Set(allValues)];
            const definedValues = uniqueValues.filter(value =>
              value !== null && value !== undefined && value !== ''
            );
            const hasUndefinedValues = uniqueValues.some(value =>
              value === null || value === undefined || value === ''
            );
            fieldValues = hasUndefinedValues
              ? [...definedValues, 'NULL']
              : definedValues;
            
          }
          fieldNames[field] = { type: fieldType, values: fieldValues };
        }
      });
    } else {
      // When no data is available, create basic field structure from column definitions
      this.columns.forEach(col => {
        if (col.field && !col.hidden) {
          fieldNames[col.field] = { 
            type: col.type || 'string', 
            values: col.values || [] 
          };
        }
        
        // Also add subFields from composite columns
        if (col.subField && !col.hidden) {
          fieldNames[col.subField] = { 
            type: col.subType || col.type || 'string', 
            values: col.values || [] 
          };
        }
      });
    }

    if (typeof createQueryEditor === 'function') {
      this.queryEditor = createQueryEditor(this.monaco, queryContainer, {
        fieldNames,
        initialValue: this.currentQuery,
        placeholder: this.generateDynamicPlaceholder(fieldNames)
      });
      
      // Store field names for comparison in future updates
      this.queryEditor.fieldNames = fieldNames;

      // Set up event handlers for query editor
      this.setupQueryEventHandlers();
    }
  }

  handleQueryChange(query) {
    // If no query parameter provided, get it from the model (for debounced calls)
    if (typeof query === 'undefined') {
      query = this.queryEditor.model?.getValue() || '';
    }
    
    // Get Monaco editor markers to check for errors
    const model = this.queryEditor.editor?.getModel();
    if (model) {
      const markers = this.monaco.editor.getModelMarkers({ resource: model.uri });
      const hasErrors = markers.some(m => m.severity === this.monaco.MarkerSeverity.Error);
      
      const queryContainer = this.toolbar.querySelector('.query-input-container');
      if (!hasErrors) {
        queryContainer.classList.remove('error');
        this.applyQuery(query);
      } else {
        queryContainer.classList.add('error');
      }
    } else {
      // Fallback if no Monaco model available
      this.applyQuery(query);
    }
  }

  _setupQueryListeners() {
    // Also check on content changes with debouncing
    let errorTimeout;
    this.queryEditor.model.onDidChangeContent(() => {
      if (errorTimeout) clearTimeout(errorTimeout);
      errorTimeout = setTimeout(() => this.handleQueryChange(), 350);
    });
  }

  _shouldUpdateFieldNames(currentFieldNames, newFieldNames) {
    // Check if field names need updating by comparing current vs new
    if (!currentFieldNames || Object.keys(currentFieldNames).length === 0) {
      return Object.keys(newFieldNames).length > 0;
    }
    
    // Check if number of fields changed
    if (Object.keys(currentFieldNames).length !== Object.keys(newFieldNames).length) {
      return true;
    }
    
    // Check if any field names or types changed
    for (const fieldName in newFieldNames) {
      if (!currentFieldNames[fieldName]) {
        return true; // New field added
      }
      
      if (currentFieldNames[fieldName].type !== newFieldNames[fieldName].type) {
        return true; // Field type changed
      }
      
      // Check if field values changed (for enum fields)
      const currentValues = currentFieldNames[fieldName].values || [];
      const newValues = newFieldNames[fieldName].values || [];
      
      if (currentValues.length !== newValues.length) {
        return true;
      }
      
      // Sort both arrays and compare - order shouldn't matter for value suggestions
      const sortedCurrentValues = [...currentValues].sort();
      const sortedNewValues = [...newValues].sort();
      
      if (sortedCurrentValues.some((val, idx) => val !== sortedNewValues[idx])) {
        return true;
      }
    }
    
    // Check if any field was removed
    for (const fieldName in currentFieldNames) {
      if (!newFieldNames[fieldName]) {
        return true; // Field removed
      }
    }
    
    return false; // No changes detected
  }

  generateDynamicPlaceholder(fieldNames) {
    if (!fieldNames || Object.keys(fieldNames).length === 0) {
      return 'Filter data... (e.g., column > value)';
    }

    const examples = [];
    const fields = Object.keys(fieldNames);
    
    // Generate examples based on available field types
    for (const field of fields.slice(0, 2)) { // Limit to first 3 fields to keep placeholder concise
      const fieldInfo = fieldNames[field];
      
      if (fieldInfo.type === 'number') {
        examples.push(`${field} > 100`);
      } else if (fieldInfo.type === 'boolean') {
        examples.push(`${field} = true`);
      } else if (fieldInfo.type === 'string') {
        if (fieldInfo.values && fieldInfo.values.length > 0) {
          // Use actual values from the data, excluding NULL
          const sampleValue = fieldInfo.values.find(v => v !== 'NULL') || fieldInfo.values[0];
          if (sampleValue && sampleValue !== 'NULL') {
            examples.push(`${field} = "${sampleValue}"`);
          } else {
            examples.push(`${field} LIKE "%text%"`);
          }
        } else {
          examples.push(`${field} LIKE "%text%"`);
        }
      }
    }

    if (examples.length === 0) {
      return 'Filter data... (e.g., column = value)';
    }

    // Create a natural-looking placeholder with 1-2 examples
    const baseText = 'Filter data...';
    if (examples.length === 1) {
      return `${baseText} (e.g., ${examples[0]})`;
    } else {
      // Combine with AND for multiple examples
      const firstTwo = examples.slice(0, 2);
      return `${baseText} (e.g., ${firstTwo.join(' AND ')})`;
    }
  }

  setupKeyboardNavigation() {
    // For fixed columns, use fixed body container for keyboard events
    const bodyContainer = this.fixedColumns > 0 ? this.fixedBodyContainer : this.bodyContainer;
    
    bodyContainer.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // Track whether focus came from keyboard (Tab) vs mouse click
    // Only auto-focus to first record on Tab navigation, not mouse clicks
    let lastInputWasKeyboard = false;
    
    bodyContainer.addEventListener('keydown', () => {
      lastInputWasKeyboard = true;
    }, { capture: true });
    
    bodyContainer.addEventListener('mousedown', () => {
      lastInputWasKeyboard = false;
    }, { capture: true });

    // Use focusin to detect when focus enters the container
    bodyContainer.addEventListener('focusin', (e) => {
      // Only auto-focus to first record if:
      // 1. There's no currently focused row
      // 2. Focus came from keyboard navigation (Tab), not mouse click
      // This prevents auto-scrolling when clicking the scrollbar
      if (!this.focusedRowId && lastInputWasKeyboard && e.target === bodyContainer) {
        this.focusFirstRecord();
      }
    });
  }

  getCurrentFocusedElement() {
    // Get the actually focused element in the browser
    const activeElement = document.activeElement;
    
    // Check if it's a checkbox in our table
    if (activeElement && activeElement.type === 'checkbox') {
      const row = activeElement.closest('.div-table-row');
      if (row && this.bodyContainer.contains(row)) {
        return { element: activeElement, row: row, type: 'checkbox' };
      }
    }
    
    // Check if it's a row in our table
    if (activeElement && activeElement.classList.contains('div-table-row')) {
      if (this.bodyContainer.contains(activeElement)) {
        return { element: activeElement, row: activeElement, type: 'row' };
      }
    }
    
    return null;
  }

  getFocusableElementForRow(row) {
    // Find the element that should receive browser focus for this row
    if (this.showCheckboxes) {
      // When checkboxes are enabled, focus the checkbox
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox) {
        return checkbox;
      }
    }
    // When no checkboxes or no checkbox found, focus the row itself (for non-checkbox tables)
    return row;
  }

  handleKeyDown(e) {
    const focusableElements = this.getAllFocusableElements();
    if (focusableElements.length === 0) return;

    // Get the currently focused element
    const currentFocus = this.getCurrentFocusedElement();
    if (!currentFocus) return;

    let currentIndex = focusableElements.indexOf(currentFocus.element);
    if (currentIndex === -1) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusElementAtIndex(Math.min(currentIndex + 1, focusableElements.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.focusElementAtIndex(Math.max(currentIndex - 1, 0));
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.handleRightArrow(currentFocus.row);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.handleLeftArrow(currentFocus.row);
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        this.handleSelectionToggleForElement(currentFocus);
        break;
    }
  }

  getAllFocusableElements() {
    // Get all elements that can receive focus (checkboxes or rows)
    // For fixed columns layout, use fixed body container
    const bodyContainer = this.fixedColumns > 0 ? this.fixedBodyContainer : this.bodyContainer;
    
    const focusableElements = [];
    const allRows = Array.from(bodyContainer.querySelectorAll('.div-table-row'));
    
    for (const row of allRows) {
      if (row.classList.contains('group-header')) {
        if (this.showCheckboxes) {
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox && checkbox.getAttribute('tabindex') === '0') {
            focusableElements.push(checkbox);
          }
        } else {
          // For group headers without checkboxes, always include the row
          focusableElements.push(row);
        }
      } else if (row.dataset.id) {
        // For data rows, check if they're visible
        const groupKey = this.getRowGroupKey(row);
        const isVisible = !groupKey || !this.collapsedGroups.has(groupKey);
        
        if (isVisible) {
          if (this.showCheckboxes) {
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.getAttribute('tabindex') === '0') {
              focusableElements.push(checkbox);
            }
          } else {
            // For rows without checkboxes, always include the row
            focusableElements.push(row);
          }
        }
      }
    }
    
    return focusableElements;
  }

  focusElementAtIndex(index) {
    const focusableElements = this.getAllFocusableElements();
    if (index >= 0 && index < focusableElements.length) {
      const element = focusableElements[index];
      element.focus();
      
      // Update our internal focus tracking
      const row = element.closest('.div-table-row');
      if (row) {
        this.updateFocusState(row);
      }
    }
  }

  updateFocusState(row) {
    // Clear previous focus classes from both containers if using fixed columns
    if (this.fixedColumns > 0) {
      this.fixedBodyContainer.querySelectorAll('.div-table-row.focused').forEach(r => r.classList.remove('focused'));
      this.scrollBodyContainer.querySelectorAll('.div-table-row.focused').forEach(r => r.classList.remove('focused'));
      
      // Set focus on both parts if this is a split row
      row.classList.add('focused');
      
      // Find and focus the corresponding row in the other container
      const rowId = row.dataset.id || row.dataset.groupKey;
      if (rowId) {
        const selector = row.dataset.id ? `[data-id="${rowId}"]` : `[data-group-key="${rowId}"]`;
        if (row.closest('.div-table-fixed-body')) {
          const scrollRow = this.scrollBodyContainer.querySelector(selector);
          if (scrollRow) scrollRow.classList.add('focused');
        } else if (row.closest('.div-table-scroll-body')) {
          const fixedRow = this.fixedBodyContainer.querySelector(selector);
          if (fixedRow) fixedRow.classList.add('focused');
        }
      }
    } else {
      // Standard single-container focus
      const previousFocused = this.bodyContainer.querySelectorAll('.div-table-row.focused');
      previousFocused.forEach(r => r.classList.remove('focused'));
      
      row.classList.add('focused');
    }
    
    if (row.classList.contains('group-header')) {
      this.focusedRowId = null;
      this.focusedGroupKey = row.dataset.groupKey;
      
      // Only trigger callback if this is a different group than last time
      if (this._lastFocusCallback.groupKey !== row.dataset.groupKey) {
        this._lastFocusCallback = { rowId: null, groupKey: row.dataset.groupKey };
        
        const groups = this.groupData(this.filteredData);
        const group = groups.find(g => g.key === row.dataset.groupKey);
        if (group) {
          const groupColumn = this.columns.find(col => col.field === this.groupByField);
          const groupInfo = {
            key: group.key,
            value: group.value,
            field: this.groupByField,
            label: groupColumn?.label || this.groupByField,
            itemCount: group.items.length
          };
          if (typeof this.onRowFocus === 'function') {
            this.onRowFocus(undefined, groupInfo);
          }
        }
      }
    } else if (row.dataset.id) {
      this.focusedRowId = row.dataset.id;
      this.focusedGroupKey = null;
      
      // Only trigger callback if this is a different row than last time
      if (this._lastFocusCallback.rowId !== row.dataset.id) {
        this._lastFocusCallback = { rowId: row.dataset.id, groupKey: null };
        
        const rowData = this.findRowData(row.dataset.id);
        if (typeof this.onRowFocus === 'function') {
          this.onRowFocus(rowData, undefined);
        }
      }
    }
  }

  handleSelectionToggleForElement(focusInfo) {
    const row = focusInfo.row;
    
    if (row.classList.contains('group-header')) {
      // Toggle group selection
      this.toggleGroupSelection(row);
    } else if (row.dataset.id) {
      // Toggle individual row selection
      this.toggleIndividualRowSelection(row);
    }
  }

  handleRightArrow(focusedRow) {
    // Right arrow: expand group if focused on a collapsed group header
    if (focusedRow && focusedRow.classList.contains('group-header') && focusedRow.classList.contains('collapsed')) {
      const groupKey = focusedRow.dataset.groupKey;
      this.collapsedGroups.delete(groupKey);
      focusedRow.classList.remove('collapsed');
      
      // Store the group key to restore focus after render
      const groupToRefocus = { key: groupKey };
      this.render();
      
      // Restore focus to the same group header
      this.restoreGroupFocus(groupToRefocus);
    }
  }

  handleLeftArrow(focusedRow) {
    // Left arrow: collapse group if focused on an expanded group header
    if (focusedRow && focusedRow.classList.contains('group-header') && !focusedRow.classList.contains('collapsed')) {
      const groupKey = focusedRow.dataset.groupKey;
      this.collapsedGroups.add(groupKey);
      focusedRow.classList.add('collapsed');
      
      // Store the group key to restore focus after render
      const groupToRefocus = { key: groupKey };
      this.render();
      
      // Restore focus to the same group header
      this.restoreGroupFocus(groupToRefocus);
    }
  }

  restoreGroupFocus(groupToRefocus) {
    // Find and restore focus to the group header after render
    const groupRow = this.bodyContainer.querySelector(`[data-group-key="${groupToRefocus.key}"]`);
    if (groupRow) {
      // Focus the appropriate element (checkbox or row)
      if (this.showCheckboxes) {
        const checkbox = groupRow.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.focus();
        }
      } else {
        groupRow.focus();
      }
      
      // Update our internal focus tracking
      this.updateFocusState(groupRow);
    }
  }

  getVisibleRows() {
    const bodyContainer = this.fixedColumns > 0 ? this.fixedBodyContainer : this.bodyContainer;
    return Array.from(bodyContainer.querySelectorAll('.div-table-row[data-id]:not(.group-header):not(.group-collapsed)'));
  }

  getAllFocusableRows() {
    // Include group headers and data rows, but exclude rows from collapsed groups
    // For fixed columns, use fixed body container
    const bodyContainer = this.fixedColumns > 0 ? this.fixedBodyContainer : this.bodyContainer;
    const allRows = Array.from(bodyContainer.querySelectorAll('.div-table-row'));
    const focusableRows = [];
    
    for (const row of allRows) {
      if (row.classList.contains('group-header')) {
        // Always include group headers
        focusableRows.push(row);
      } else if (row.dataset.id) {
        // For data rows, check if their group is collapsed
        const groupKey = this.getRowGroupKey(row);
        if (!groupKey || !this.collapsedGroups.has(groupKey)) {
          // Include row if it's not in a collapsed group
          focusableRows.push(row);
        }
      }
    }
    
    return focusableRows;
  }

  getRowGroupKey(row) {
    // Find the group key for a data row by looking at preceding group headers
    let currentElement = row.previousElementSibling;
    while (currentElement) {
      if (currentElement.classList.contains('group-header')) {
        return currentElement.dataset.groupKey;
      }
      currentElement = currentElement.previousElementSibling;
    }
    return null;
  }

  focusRow(index) {
    // This method is now replaced by focusElementAtIndex for consistency
    // but kept for backward compatibility
    const focusableElements = this.getAllFocusableElements();
    if (index >= 0 && index < focusableElements.length) {
      this.focusElementAtIndex(index);
    }
  }

  focusFirstRecord() {
    const rows = this.getAllFocusableRows();
    if (rows.length > 0) {
      this.focusRow(0);
    }
  }

  setFocusedRow(rowId, skipCheckboxFocus = false) {
    // Remove previous focus
    this.bodyContainer.querySelectorAll('.div-table-row.focused').forEach(row => {
      row.classList.remove('focused');
    });

    if (rowId) {
      const row = this.bodyContainer.querySelector(`[data-id="${rowId}"]`);
      if (row) {
        row.classList.add('focused');
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // If the row has a checkbox and we're not skipping focus, focus it to sync tabIndex navigation
        if (!skipCheckboxFocus) {
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox && document.activeElement !== checkbox) {
            checkbox.focus();
          }
        }
        
        // Only trigger callback if this is a different row than last time
        if (this._lastFocusCallback.rowId !== rowId) {
          this._lastFocusCallback = { rowId: rowId, groupKey: null };
          
          const rowData = this.findRowData(rowId);
          this.onRowFocus(rowData);
        }
      }
    }

    this.focusedRowId = rowId;
  }

  setFocusedGroup(group) {
    // Remove previous focus from both rows and groups
    this.bodyContainer.querySelectorAll('.div-table-row.focused').forEach(row => {
      row.classList.remove('focused');
    });

    // Clear focused row ID since we're focusing a group
    this.focusedRowId = null;

    // Add focus to the group header
    const groupRow = this.bodyContainer.querySelector(`[data-group-key="${group.key}"]`);
    if (groupRow) {
      groupRow.classList.add('focused');
      groupRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Create group info for the callback
      const groupColumn = this.columns.find(col => col.field === this.groupByField);
      const groupInfo = {
        key: group.key,
        value: group.value,
        field: this.groupByField,
        label: groupColumn?.label || this.groupByField,
        itemCount: group.items.length
      };
      
      // Trigger focus callback with row=undefined and group info
      this.onRowFocus(undefined, groupInfo);
    }
  }

  findRowData(rowId) {
    // First try to find in the current filteredData
    let result = this.filteredData.find(item => 
      String(item[this.primaryKeyField]) === String(rowId)
    );
    
    // If not found in filteredData, search in the original data
    // This ensures we can always find the data even if there are timing issues
    if (!result) {
      result = this.data.find(item => 
        String(item[this.primaryKeyField]) === String(rowId)
      );
    }
    
    return result;
  }

  handleSelectionToggle(currentIndex) {
    const rows = this.getAllFocusableRows();
    if (currentIndex < 0 || currentIndex >= rows.length) return;

    const row = rows[currentIndex];
    
    if (row.classList.contains('group-header')) {
      // Toggle group selection
      this.toggleGroupSelection(row);
    } else if (row.dataset.id) {
      // Toggle individual row selection
      this.toggleIndividualRowSelection(row);
    }
  }

  toggleGroupSelection(groupRow) {
    const groupKey = groupRow.dataset.groupKey;
    const groups = this.groupData(this.filteredData);
    const group = groups.find(g => g.key === groupKey);
    
    if (!group) return;
    
    // Check current selection state of the group
    const groupItemIds = group.items.map(item => String(item[this.primaryKeyField]));
    const selectedInGroup = groupItemIds.filter(id => this.selectedRows.has(id));
    const shouldSelect = selectedInGroup.length < groupItemIds.length;
    
    // Toggle all items in the group
    group.items.forEach(item => {
      const itemId = String(item[this.primaryKeyField]);
      if (shouldSelect) {
        this.selectedRows.add(itemId);
        item.selected = true;
      } else {
        this.selectedRows.delete(itemId);
        item.selected = false;
      }
    });
    
    // Update visual states
    this.updateSelectionStates();
    this.updateInfoSection();
    
    // Trigger selection change callback
    if (typeof this.onSelectionChange === 'function') {
      this.onSelectionChange(Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean));
    }
  }

  toggleIndividualRowSelection(row) {
    const rowId = row.dataset.id;
    if (!rowId) {
      console.warn('DivTable: Row missing data-id attribute');
      return;
    }
    
    const rowData = this.findRowData(rowId);
    if (!rowData) {
      console.warn('DivTable: Could not find data for row ID:', rowId);
      return;
    }

    const isSelected = this.selectedRows.has(rowId);
    
    if (isSelected) {
      this.selectedRows.delete(rowId);
      rowData.selected = false;
      row.classList.remove('selected');
    } else {
      if (!this.multiSelect) {
        this.clearSelection();
      }
      this.selectedRows.add(rowId);
      rowData.selected = true;
      row.classList.add('selected');
    }
    
    // Update visual states
    this.updateSelectionStates();
    this.updateInfoSection();
    
    // Trigger selection change callback with verified data
    const selectedData = Array.from(this.selectedRows)
      .map(id => this.findRowData(id))
      .filter(Boolean);
    
    if (typeof this.onSelectionChange === 'function') {
      this.onSelectionChange(selectedData);
    }
  }

  toggleRowSelection(index) {
    const rows = this.getVisibleRows();
    if (index < 0 || index >= rows.length) return;

    const row = rows[index];
    const rowId = row.dataset.id;
    const rowData = this.findRowData(rowId);
    
    if (!rowData) return;

    const isSelected = this.selectedRows.has(rowId);
    
    if (isSelected) {
      this.selectedRows.delete(rowId);
      rowData.selected = false;
      row.classList.remove('selected');
    } else {
      if (!this.multiSelect) {
        this.clearSelection();
      }
      this.selectedRows.add(rowId);
      rowData.selected = true;
      row.classList.add('selected');
    }

    this.updateCheckboxes();
    if (typeof this.onSelectionChange === 'function') {
      this.onSelectionChange(Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean));
    }
  }

  clearSelection() {
    this.selectedRows.clear();
    this.filteredData.forEach(item => item.selected = false);
    this.updateSelectionStates();
    this.updateInfoSection();
  }

  updateCheckboxes() {
    // Handle fixed columns layout
    if (this.fixedColumns > 0) {
      this.fixedBodyContainer.querySelectorAll('.div-table-row[data-id] input[type="checkbox"]').forEach(checkbox => {
        const rowId = checkbox.closest('.div-table-row').dataset.id;
        checkbox.checked = this.selectedRows.has(rowId);
      });
    } else {
      this.bodyContainer.querySelectorAll('.div-table-row[data-id] input[type="checkbox"]').forEach(checkbox => {
        const rowId = checkbox.closest('.div-table-row').dataset.id;
        checkbox.checked = this.selectedRows.has(rowId);
      });
    }
  }

  updateSelectionStates() {
    // Handle fixed columns layout
    if (this.fixedColumns > 0) {
      this.updateSelectionStatesWithFixedColumns();
      return;
    }
    
    // Update individual row selection states
    this.bodyContainer.querySelectorAll('.div-table-row[data-id]').forEach(row => {
      const rowId = row.dataset.id;
      const checkbox = row.querySelector('input[type="checkbox"]');
      
      if (this.selectedRows.has(rowId)) {
        row.classList.add('selected');
        if (checkbox) checkbox.checked = true;
      } else {
        row.classList.remove('selected');
        if (checkbox) checkbox.checked = false;
      }
    });

    // Update group header checkbox states (always check for group headers in DOM)
    const groupHeaders = this.bodyContainer.querySelectorAll('.div-table-row.group-header');
    if (groupHeaders.length > 0) {
      // Group headers exist, so groupByField must be set - get the groups
      const groups = this.groupData(this.sortData(this.filteredData));
      
      groupHeaders.forEach((groupRow) => {
        const checkbox = groupRow.querySelector('input[type="checkbox"]');
        if (!checkbox) return;

        // Find the group by matching the groupKey
        const groupKey = groupRow.dataset.groupKey;
        const group = groups.find(g => g.key === groupKey);
        if (!group) return;

        // Calculate selection state for this group
        const groupItemIds = group.items.map(item => String(item[this.primaryKeyField]));
        const selectedInGroup = groupItemIds.filter(id => this.selectedRows.has(id));

        // Set indeterminate BEFORE checked to ensure proper visual update
        if (selectedInGroup.length === 0) {
          checkbox.indeterminate = false;
          checkbox.checked = false;
        } else if (selectedInGroup.length === groupItemIds.length) {
          checkbox.indeterminate = false;
          checkbox.checked = true;
        } else {
          checkbox.indeterminate = true;
          checkbox.checked = false;
        }
      });
    }

    // Update main header checkbox state
    this.updateHeaderCheckbox();
    
    // Update summary row aggregates based on current selection
    this.updateSummaryRows();
  }

  updateSelectionStatesWithFixedColumns() {
    // Update rows in fixed body container
    this.fixedBodyContainer.querySelectorAll('.div-table-row[data-id]').forEach(row => {
      const rowId = row.dataset.id;
      const checkbox = row.querySelector('input[type="checkbox"]');
      
      if (this.selectedRows.has(rowId)) {
        row.classList.add('selected');
        if (checkbox) checkbox.checked = true;
      } else {
        row.classList.remove('selected');
        if (checkbox) checkbox.checked = false;
      }
    });
    
    // Update corresponding rows in scroll body container
    this.scrollBodyContainer.querySelectorAll('.div-table-row[data-id]').forEach(row => {
      const rowId = row.dataset.id;
      
      if (this.selectedRows.has(rowId)) {
        row.classList.add('selected');
      } else {
        row.classList.remove('selected');
      }
    });
    
    // Update group header checkbox states (always check for group headers in DOM)
    const groupHeaders = this.fixedBodyContainer.querySelectorAll('.div-table-row.group-header');
    if (groupHeaders.length > 0) {
      // Group headers exist, so groupByField must be set - get the groups
      const groups = this.groupData(this.sortData(this.filteredData));
      
      groupHeaders.forEach((groupRow) => {
        const checkbox = groupRow.querySelector('input[type="checkbox"]');
        if (!checkbox) return;

        const groupKey = groupRow.dataset.groupKey;
        const group = groups.find(g => g.key === groupKey);
        if (!group) return;

        const groupItemIds = group.items.map(item => String(item[this.primaryKeyField]));
        const selectedInGroup = groupItemIds.filter(id => this.selectedRows.has(id));

        // Set indeterminate BEFORE checked to ensure proper visual update
        if (selectedInGroup.length === 0) {
          checkbox.indeterminate = false;
          checkbox.checked = false;
        } else if (selectedInGroup.length === groupItemIds.length) {
          checkbox.indeterminate = false;
          checkbox.checked = true;
        } else {
          checkbox.indeterminate = true;
          checkbox.checked = false;
        }
      });
    }

    // Update main header checkbox state
    this.updateHeaderCheckbox();
    
    // Update summary row aggregates based on current selection
    this.updateSummaryRows();
  }

  updateHeaderCheckbox() {
    // Find header checkbox - in fixed header for fixed columns layout, otherwise in regular header
    let headerCheckbox;
    if (this.fixedColumns > 0) {
      headerCheckbox = this.fixedHeaderContainer.querySelector('input[type="checkbox"]');
    } else {
      headerCheckbox = this.headerContainer.querySelector('input[type="checkbox"]');
    }
    if (!headerCheckbox) return;

    const totalItems = this.filteredData.length;
    const selectedItems = this.filteredData.filter(item => 
      this.selectedRows.has(String(item[this.primaryKeyField]))
    ).length;

    if (selectedItems === 0) {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = false;
    } else if (selectedItems === totalItems) {
      headerCheckbox.checked = true;
      headerCheckbox.indeterminate = false;
    } else {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = true;
    }
  }

  updateTabIndexes() {
    // Handle fixed columns layout
    const bodyContainer = this.fixedColumns > 0 ? this.fixedBodyContainer : this.bodyContainer;
    
    // Update tabindex for checkboxes only, not rows
    const allRows = Array.from(bodyContainer.querySelectorAll('.div-table-row'));
    
    for (const row of allRows) {
      if (row.classList.contains('group-header')) {
        if (this.showCheckboxes) {
          // For group headers with checkboxes, make the checkbox focusable
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.setAttribute('tabindex', '0');
          }
        }
      } else if (row.dataset.id) {
        // For data rows, check if their group is collapsed
        const groupKey = this.getRowGroupKey(row);
        const isVisible = !groupKey || !this.collapsedGroups.has(groupKey);
        
        if (this.showCheckboxes) {
          // When checkboxes are enabled, make the checkbox focusable if visible
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.setAttribute('tabindex', isVisible ? '0' : '-1');
          }
        }
      }
    }
  }

  render() {
    this.renderHeader();
    this.renderBody();
    this.updateInfoSection();
    this.updateSelectionStates();
    this.updateTabIndexes(); // Update tab navigation order
    
    // Verify data consistency in development mode
    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'production') {
      setTimeout(() => this.verifyDataConsistency(), 0);
    }
  }

  renderHeader() {
    // Handle fixed columns layout
    if (this.fixedColumns > 0) {
      this.renderHeaderWithFixedColumns();
      return;
    }
    
    this.headerContainer.innerHTML = '';
    
    const compositeColumns = this.getCompositeColumns();
    
    // Build grid template based on composite columns
    let gridTemplate = '';
    if (this.showCheckboxes) {
      gridTemplate = '40px '; // Checkbox column
    }
    
    // Add column templates for each composite group
    compositeColumns.forEach(composite => {
      // For composite columns, use the responsive size of the first column
      const firstCol = composite.columns[0];
      const responsive = firstCol.responsive || {};
      switch (responsive.size) {
        case 'fixed-narrow':
          gridTemplate += '80px ';
          break;
        case 'fixed-medium':
          gridTemplate += '120px ';
          break;
        case 'flexible-small':
          gridTemplate += '1fr ';
          break;
        case 'flexible-medium':
          gridTemplate += '2fr ';
          break;
        case 'flexible-large':
          gridTemplate += '3fr ';
          break;
        default:
          gridTemplate += '1fr ';
      }
    });
    
    this.headerContainer.style.gridTemplateColumns = gridTemplate.trim();

    // Checkbox column header
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-header-cell checkbox-column';
      
      if (this.multiSelect) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', (e) => {
          if (e.target.checked) {
            // If checked, select all
            this.selectAll();
          } else {
            // If unchecked, clear selection
            this.clearSelection();
            
            // If filter is active, re-render to show all rows
            if (this.showOnlySelected) {
              this.renderBody();
              this.updateInfoSection();
            }
          }
        });
        checkboxCell.appendChild(checkbox);
      }
      
      this.headerContainer.appendChild(checkboxCell);
    }

    // Column headers - iterate through composite columns
    compositeColumns.forEach(composite => {
      const headerCell = document.createElement('div');
      headerCell.className = 'div-table-header-cell';
      
      if (composite.compositeName) {
        // This is a composite cell with multiple columns
        headerCell.classList.add('composite-header');
        this.renderCompositeHeaderCell(headerCell, composite);
      } else {
        // Single column
        headerCell.classList.add('sortable');
        const col = composite.columns[0];
        this.renderSingleHeaderCell(headerCell, col);
      }
      
      this.headerContainer.appendChild(headerCell);
    });
    
    // Add scrollbar spacer if body has a scrollbar
    this.updateScrollbarSpacer();
  }

  renderHeaderWithFixedColumns() {
    this.fixedHeaderContainer.innerHTML = '';
    this.scrollHeaderContainer.innerHTML = '';
    
    const { fixedColumns, scrollColumns } = this.splitColumnsForFixedLayout();
    
    // Build grid template for fixed section
    let fixedGridTemplate = '';
    if (this.showCheckboxes) {
      fixedGridTemplate = '40px '; // Checkbox column always in fixed section
    }
    
    fixedColumns.forEach(composite => {
      fixedGridTemplate += this.getColumnGridSize(composite, true) + ' ';
    });
    
    this.fixedHeaderContainer.style.gridTemplateColumns = fixedGridTemplate.trim();
    
    // Build grid template for scrollable section - use inner wrapper for scrolling
    let scrollGridTemplate = '';
    scrollColumns.forEach(composite => {
      scrollGridTemplate += this.getColumnGridSize(composite) + ' ';
    });
    
    // Create inner wrapper for scroll header content
    this.scrollHeaderInner = document.createElement('div');
    this.scrollHeaderInner.className = 'div-table-scroll-header-inner';
    this.scrollHeaderInner.style.gridTemplateColumns = scrollGridTemplate.trim();
    this.scrollHeaderContainer.appendChild(this.scrollHeaderInner);
    
    // Render checkbox in fixed header
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-header-cell checkbox-column';
      
      if (this.multiSelect) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', (e) => {
          if (e.target.checked) {
            this.selectAll();
          } else {
            this.clearSelection();
            if (this.showOnlySelected) {
              this.renderBody();
              this.updateInfoSection();
            }
          }
        });
        checkboxCell.appendChild(checkbox);
      }
      
      this.fixedHeaderContainer.appendChild(checkboxCell);
    }
    
    // Render fixed column headers
    fixedColumns.forEach(composite => {
      const headerCell = this.createHeaderCell(composite);
      this.fixedHeaderContainer.appendChild(headerCell);
    });
    
    // Render scrollable column headers
    scrollColumns.forEach(composite => {
      const headerCell = this.createHeaderCell(composite);
      this.scrollHeaderInner.appendChild(headerCell);
    });
    
    // Synchronize header heights
    this.syncFixedColumnsHeaderHeights();
  }
  
  syncFixedColumnsHeaderHeights() {
    if (!this.fixedColumns || this.fixedColumns <= 0) return;
    if (!this.fixedHeaderContainer || !this.scrollHeaderContainer) return;
    
    // Reset heights first
    this.fixedHeaderContainer.style.height = '';
    this.scrollHeaderContainer.style.height = '';
    
    // Get natural heights
    const fixedHeight = this.fixedHeaderContainer.offsetHeight;
    const scrollHeight = this.scrollHeaderContainer.offsetHeight;
    
    // Set both to the maximum height
    const maxHeight = Math.max(fixedHeight, scrollHeight);
    if (maxHeight > 0) {
      this.fixedHeaderContainer.style.height = `${maxHeight}px`;
      this.scrollHeaderContainer.style.height = `${maxHeight}px`;
    }
  }
  
  syncFixedColumnsRowHeights() {
    if (!this.fixedColumns || this.fixedColumns <= 0) return;
    if (!this.fixedBodyContainer || !this.scrollBodyContainer) return;
    
    const fixedRows = this.fixedBodyContainer.querySelectorAll('.div-table-row');
    const scrollRows = this.scrollBodyContainer.querySelectorAll('.div-table-row');
    
    if (fixedRows.length !== scrollRows.length) return;
    
    fixedRows.forEach((fixedRow, index) => {
      const scrollRow = scrollRows[index];
      if (!scrollRow) return;
      
      // Reset heights first
      fixedRow.style.height = '';
      scrollRow.style.height = '';
      
      // Get natural heights including any cell content overflow
      const fixedHeight = Math.max(fixedRow.offsetHeight, fixedRow.scrollHeight);
      const scrollHeight = Math.max(scrollRow.offsetHeight, scrollRow.scrollHeight);
      
      // Also check individual cell heights
      let maxCellHeight = 0;
      fixedRow.querySelectorAll('.div-table-cell').forEach(cell => {
        maxCellHeight = Math.max(maxCellHeight, cell.offsetHeight, cell.scrollHeight);
      });
      scrollRow.querySelectorAll('.div-table-cell').forEach(cell => {
        maxCellHeight = Math.max(maxCellHeight, cell.offsetHeight, cell.scrollHeight);
      });
      
      // Set both to the maximum height
      const maxHeight = Math.max(fixedHeight, scrollHeight, maxCellHeight);
      if (maxHeight > 0) {
        fixedRow.style.height = `${maxHeight}px`;
        scrollRow.style.height = `${maxHeight}px`;
      }
    });
  }
  
  syncFixedColumnsColumnWidths() {
    if (!this.fixedColumns || this.fixedColumns <= 0) return;
    if (!this.scrollHeaderInner || !this.scrollBodyContainer) return;
    
    const { scrollColumns } = this.splitColumnsForFixedLayout();
    const numColumns = scrollColumns.length;
    if (numColumns === 0) return;
    
    // Collect all cells for each column position
    const headerCells = Array.from(this.scrollHeaderInner.querySelectorAll('.div-table-header-cell'));
    const bodyRows = Array.from(this.scrollBodyContainer.querySelectorAll('.div-table-row:not(.group-header)'));
    
    // Calculate max width for each column
    const columnWidths = [];
    
    for (let colIndex = 0; colIndex < numColumns; colIndex++) {
      let maxWidth = 0;
      
      // Check header cell
      if (headerCells[colIndex]) {
        // Reset any previously set width
        headerCells[colIndex].style.minWidth = '';
        headerCells[colIndex].style.width = '';
        maxWidth = Math.max(maxWidth, headerCells[colIndex].scrollWidth);
      }
      
      // Check all body row cells
      bodyRows.forEach(row => {
        const cells = row.querySelectorAll('.div-table-cell');
        if (cells[colIndex]) {
          // Reset any previously set width
          cells[colIndex].style.minWidth = '';
          cells[colIndex].style.width = '';
          maxWidth = Math.max(maxWidth, cells[colIndex].scrollWidth);
        }
      });
      
      // Add some padding for comfortable reading
      columnWidths.push(maxWidth + 4);
    }
    
    // Apply calculated widths to all cells
    // Build grid template from calculated widths
    const gridTemplate = columnWidths.map(w => `${w}px`).join(' ');
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
    
    // Apply to header inner wrapper
    this.scrollHeaderInner.style.gridTemplateColumns = gridTemplate;
    
    // Apply to all body rows (including group headers need special handling)
    const allRows = this.scrollBodyContainer.querySelectorAll('.div-table-row');
    allRows.forEach(row => {
      if (row.classList.contains('group-header')) {
        // Group headers span all columns - set explicit width to match total
        row.style.gridTemplateColumns = '1fr';
        row.style.minWidth = `${totalWidth}px`;
      } else if (row.classList.contains('summary-row')) {
        // Summary rows need the same grid template as regular rows
        row.style.gridTemplateColumns = gridTemplate;
        row.style.minWidth = `${totalWidth}px`;
      } else {
        row.style.gridTemplateColumns = gridTemplate;
      }
    });
    
    // Update shadow visibility based on whether horizontal scrolling is needed
    this.updateFixedColumnsShadow();
  }
  
  updateFixedColumnsShadow() {
    if (!this.fixedColumns || this.fixedColumns <= 0) return;
    if (!this.scrollBodyContainer || !this.fixedSection) return;
    
    // Check if horizontal scrolling is needed
    const hasHorizontalScroll = this.scrollBodyContainer.scrollWidth > this.scrollBodyContainer.clientWidth;
    
    if (hasHorizontalScroll) {
      this.fixedSection.classList.add('has-scroll-shadow');
    } else {
      this.fixedSection.classList.remove('has-scroll-shadow');
    }
  }

  getColumnGridSize(composite, isFixedContainer = false) {
    const firstCol = composite.columns[0];
    const responsive = firstCol.responsive || {};
    switch (responsive.size) {
      case 'fixed-narrow':
        return '80px';
      case 'fixed-medium':
        return '120px';
      case 'flexible-small':
        return isFixedContainer ? 'minmax(80px, 150px)' : '1fr';
      case 'flexible-medium':
        return isFixedContainer ? 'minmax(100px, 200px)' : '2fr';
      case 'flexible-large':
        return isFixedContainer ? 'minmax(120px, 280px)' : '3fr';
      default:
        return isFixedContainer ? 'minmax(100px, 200px)' : '1fr';
    }
  }

  createHeaderCell(composite) {
    const headerCell = document.createElement('div');
    headerCell.className = 'div-table-header-cell';
    
    if (composite.compositeName) {
      headerCell.classList.add('composite-header');
      this.renderCompositeHeaderCell(headerCell, composite);
    } else {
      headerCell.classList.add('sortable');
      const col = composite.columns[0];
      this.renderSingleHeaderCell(headerCell, col);
    }
    
    return headerCell;
  }
  
  updateScrollbarSpacer() {
    // Remove existing spacer if present
    const existingSpacer = this.headerContainer.querySelector('.scrollbar-spacer');
    if (existingSpacer) {
      existingSpacer.remove();
    }
    
    // Check if body has a scrollbar
    const hasScrollbar = this.bodyContainer.scrollHeight > this.bodyContainer.clientHeight;
    
    if (hasScrollbar) {
      // Calculate scrollbar width
      const scrollbarWidth = this.bodyContainer.offsetWidth - this.bodyContainer.clientWidth;
      
      // Add spacer div as an additional grid column
      const spacer = document.createElement('div');
      spacer.className = 'scrollbar-spacer';
      spacer.style.width = `${scrollbarWidth}px`;
      
      // Update header grid template to include spacer column
      const currentTemplate = this.headerContainer.style.gridTemplateColumns;
      this.headerContainer.style.gridTemplateColumns = `${currentTemplate} ${scrollbarWidth}px`;
      
      this.headerContainer.appendChild(spacer);
    }
  }

  renderSingleHeaderCell(headerCell, col) {
    // Check if this column has a subLabel (composite column with two-line header)
    if (col.subLabel) {
      // Create vertical stacked header for composite columns
      headerCell.classList.add('composite-header');
      headerCell.style.display = 'flex';
      headerCell.style.flexDirection = 'column';
      headerCell.style.gap = '0';
      headerCell.style.padding = '8px 12px';
      headerCell.style.alignItems = 'flex-start';
      
      // Create container for main label with indicators
      const mainLabelContainer = document.createElement('div');
      mainLabelContainer.style.display = 'flex';
      mainLabelContainer.style.alignItems = 'center';
      mainLabelContainer.style.width = '100%';
      mainLabelContainer.style.marginBottom = '4px';
      
      // Main label
      const mainLabel = document.createElement('span');
      mainLabel.className = 'composite-main-header';
      mainLabel.innerHTML = col.label || col.field;
      mainLabel.title = this.stripHtmlTags(col.label || col.field);
      mainLabel.style.fontWeight = '600';
      mainLabel.style.textAlign = 'left';
      mainLabel.style.flex = '1';
      mainLabelContainer.appendChild(mainLabel);
      
      // Right-aligned indicators wrapper
      const rightContent = document.createElement('div');
      rightContent.className = 'header-right-content';
      rightContent.style.display = 'flex';
      rightContent.style.alignItems = 'center';
      rightContent.style.gap = '4px';
      rightContent.style.marginLeft = 'auto';
      
      // Add groupable indicator if column is groupable
      if (col.groupable !== false && !col.hidden) {
        const groupIndicator = document.createElement('span');
        groupIndicator.className = 'group-indicator';
        if (this.groupByField === col.field) {
          groupIndicator.classList.add('grouped');
        }
        groupIndicator.textContent = this.groupByField === col.field ? '☴' : '☷';
        groupIndicator.style.cursor = 'pointer';
        groupIndicator.style.fontSize = '1em';
        const columnTitle = this.stripHtmlTags(col.label || col.field);
        groupIndicator.title = this.groupByField === col.field ? `Grouped by ${columnTitle} (click to ungroup)` : `Click to group by ${columnTitle}`;
        
        // Add click handler for grouping
        groupIndicator.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent triggering sort
          if (this.groupByField === col.field) {
            this.group('');
          } else {
            this.group(col.field);
          }
        });
        
        rightContent.appendChild(groupIndicator);
      }
      
      // Add sort indicator placeholder
      const sortIndicator = document.createElement('span');
      sortIndicator.className = 'sort-indicator';
      sortIndicator.style.marginLeft = '4px';
      
      if (this.sortColumn === col.field) {
        sortIndicator.classList.add('active');
        sortIndicator.textContent = this.sortDirection === 'asc' ? '↑' : '↓';
      } else {
        sortIndicator.textContent = '⇅';
      }
      
      rightContent.appendChild(sortIndicator);
      mainLabelContainer.appendChild(rightContent);
      headerCell.appendChild(mainLabelContainer);
      
      // Sub label with sorting capability
      const subLabelContainer = document.createElement('div');
      subLabelContainer.className = 'composite-sub-header sortable';
      subLabelContainer.style.display = 'flex';
      subLabelContainer.style.alignItems = 'center';
      subLabelContainer.style.width = '100%';
      subLabelContainer.style.cursor = 'pointer';
      subLabelContainer.style.borderRadius = '4px';
      subLabelContainer.style.transition = 'background-color 0.2s ease';
      
      const subLabel = document.createElement('span');
      subLabel.innerHTML = col.subLabel;
      subLabel.title = this.stripHtmlTags(col.subLabel);
      subLabel.style.textAlign = 'left';
      subLabel.style.flex = '1';
      subLabelContainer.appendChild(subLabel);
      
      // Add sort indicator for sub-field
      if (col.subField) {
        const subSortIndicator = document.createElement('span');
        subSortIndicator.className = 'sub-sort-indicator';
        subSortIndicator.style.marginLeft = '4px';
        
        if (this.sortColumn === col.subField) {
          subSortIndicator.classList.add('active');
          subSortIndicator.textContent = this.sortDirection === 'asc' ? '↑' : '↓';
        } else {
          subSortIndicator.textContent = '⇅';
        }
        
        subLabelContainer.appendChild(subSortIndicator);
        
        // Add hover effect - use CSS variable for theming support
        subLabelContainer.addEventListener('mouseenter', () => {
          subLabelContainer.style.backgroundColor = 'var(--dt-bg-disabled)';
        });
        subLabelContainer.addEventListener('mouseleave', () => {
          subLabelContainer.style.backgroundColor = 'transparent';
        });
        
        // Add click handler for sorting by subField
        subLabelContainer.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent triggering parent sort
          this.sort(col.subField);
        });
      }
      
      headerCell.appendChild(subLabelContainer);
      
      // Add sort functionality for main label
      mainLabelContainer.addEventListener('click', (e) => {
        const isGroupControl = e.target.classList.contains('group-indicator') || 
                              e.target.closest('.group-indicator');
        if (!isGroupControl) {
          this.sort(col.field);
        }
      });
      
      return;
    }
    
    // Left-aligned content wrapper
    const leftContent = document.createElement('div');
    leftContent.className = 'header-left-content';
    
    // Add collapse/expand all toggle if this column is currently grouped
    if (this.groupByField === col.field) {
      const groups = this.groupData(this.filteredData);
      const groupCount = groups.length;
      const columnLabel = col.label || col.field;
      
      // Collapse/expand all toggle button
      const toggleAllBtn = document.createElement('span');
      toggleAllBtn.className = 'group-toggle-all';
      
      // Check if all groups are collapsed
      const allCollapsed = groups.every(g => this.collapsedGroups.has(g.key));
      if (allCollapsed) {
        toggleAllBtn.classList.add('collapsed');
      }
      toggleAllBtn.textContent = '❯';
      toggleAllBtn.title = allCollapsed ? 'Expand all groups' : 'Collapse all groups';
      
      toggleAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (allCollapsed) {
          // Expand all groups
          this.collapsedGroups.clear();
        } else {
          // Collapse all groups
          groups.forEach(group => {
            this.collapsedGroups.add(group.key);
          });
        }
        
        this.render();
      });
      
      leftContent.appendChild(toggleAllBtn);
      
      // Column label
      const labelSpan = document.createElement('span');
      labelSpan.innerHTML = columnLabel;
      labelSpan.title = this.stripHtmlTags(columnLabel);
      //labelSpan.style.fontWeight = 'bold';
      leftContent.appendChild(labelSpan);
      
      // Count
      const countSpan = document.createElement('span');
      countSpan.className = 'group-count';
      countSpan.innerHTML = `&nbsp;(${groupCount})`;
      countSpan.style.opacity = '0.8';
      countSpan.style.fontSize = '0.9em';
      countSpan.style.fontWeight = 'normal';
      countSpan.title = `${groupCount} distinct value${groupCount === 1 ? '' : 's'} in ${this.stripHtmlTags(columnLabel)}`;
      leftContent.appendChild(countSpan);
    } else {
      // Regular column label
      const labelSpan = document.createElement('span');
      labelSpan.innerHTML = col.label || col.field;
      labelSpan.title = this.stripHtmlTags(col.label || col.field);
      //labelSpan.style.fontWeight = 'bold';
      leftContent.appendChild(labelSpan);
    }
    
    headerCell.appendChild(leftContent);
    
    // Right-aligned indicators wrapper
    const rightContent = document.createElement('div');
    rightContent.className = 'header-right-content';
    
    // Add groupable indicator if column is groupable (right-aligned)
    if (col.groupable !== false && !col.hidden) {
      const groupIndicator = document.createElement('span');
      groupIndicator.className = 'group-indicator';
      if (this.groupByField === col.field) {
        groupIndicator.classList.add('grouped');
      }
      groupIndicator.textContent = this.groupByField === col.field ? '☴' : '☷';
      groupIndicator.style.cursor = 'pointer';
      groupIndicator.style.fontSize = '1em';
      const columnTitle = this.stripHtmlTags(col.label || col.field);
      groupIndicator.title = this.groupByField === col.field ? `Grouped by ${columnTitle} (click to ungroup)` : `Click to group by ${columnTitle}`;
      
      // Add click handler for grouping
      groupIndicator.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering sort
        if (this.groupByField === col.field) {
          // If already grouped by this column, remove grouping
          this.group('');
        } else {
          // Group by this column
          this.group(col.field);
        }
      });
      
      rightContent.appendChild(groupIndicator);
    }
    
    // Add sort indicator
    const sortIndicator = document.createElement('span');
    sortIndicator.className = 'sort-indicator';
    sortIndicator.style.fontSize = '12px';
    sortIndicator.style.marginLeft = '4px';
    
    if (this.sortColumn === col.field) {
      sortIndicator.classList.add('active');
      
      // Check if this is a grouped field to show special indicators
      const isGroupedField = this.groupByField && col.field === this.groupByField;
      
      if (isGroupedField && this.sortMode === 'count') {
        // Count-based sorting: show 1 or 9
        sortIndicator.textContent = this.sortDirection === 'asc' ? '↑1' : '↓9';
      } else if (isGroupedField && this.sortMode === 'value') {
        // Value-based sorting on grouped field: show a or z
        sortIndicator.textContent = this.sortDirection === 'asc' ? '↑A' : '↓Z';
      } else {
        // Regular sorting: standard arrows
        sortIndicator.textContent = this.sortDirection === 'asc' ? '↑' : '↓';
      }
      
      headerCell.classList.add('sorted', this.sortDirection);
    } else {
      sortIndicator.textContent = '⇅';
    }
    
    rightContent.appendChild(sortIndicator);
    headerCell.appendChild(rightContent);

    headerCell.addEventListener('click', (e) => {
      // Only sort if not clicking on group indicator, toggle all, or their parent containers
      const isGroupControl = e.target.classList.contains('group-indicator') || 
                            e.target.classList.contains('group-toggle-all') ||
                            e.target.closest('.group-toggle-all') ||
                            e.target.closest('.group-indicator');
      
      if (!isGroupControl) {
        this.sort(col.field);
      }
    });
  }

  renderCompositeHeaderCell(headerCell, composite) {
    // Composite header contains multiple sub-columns stacked vertically
    headerCell.style.display = 'flex';
    headerCell.style.flexDirection = 'column';
    headerCell.style.gap = '4px';
    headerCell.style.padding = '8px 12px';
    
    // Check if any column in this composite is grouped
    const groupedColumn = composite.columns.find(col => this.groupByField === col.field);
    
    composite.columns.forEach((col, index) => {
      const subHeader = document.createElement('div');
      subHeader.className = 'composite-sub-header sortable';
      subHeader.style.display = 'flex';
      subHeader.style.alignItems = 'center';
      subHeader.style.gap = '8px';
      
      // Left-aligned content wrapper
      const leftContent = document.createElement('div');
      leftContent.style.display = 'flex';
      leftContent.style.alignItems = 'center';
      leftContent.style.gap = '8px';
      leftContent.style.flex = '1';
      
      // Add collapse/expand all toggle if this column is currently grouped
      if (this.groupByField === col.field) {
        const groups = this.groupData(this.filteredData);
        const groupCount = groups.length;
        const columnLabel = col.label || col.field;
        
        // Collapse/expand all toggle button
        const toggleAllBtn = document.createElement('span');
        toggleAllBtn.className = 'group-toggle-all';
        
        // Check if all groups are collapsed
        const allCollapsed = groups.every(g => this.collapsedGroups.has(g.key));
        if (allCollapsed) {
          toggleAllBtn.classList.add('collapsed');
        }
        toggleAllBtn.textContent = '❯';
        toggleAllBtn.title = allCollapsed ? 'Expand all groups' : 'Collapse all groups';
        
        toggleAllBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          
          if (allCollapsed) {
            // Expand all groups
            this.collapsedGroups.clear();
          } else {
            // Collapse all groups
            groups.forEach(group => {
              this.collapsedGroups.add(group.key);
            });
          }
          
          this.render();
        });
        
        leftContent.appendChild(toggleAllBtn);
        
        // Column label
        const labelSpan = document.createElement('span');
        labelSpan.innerHTML = columnLabel;
        labelSpan.title = this.stripHtmlTags(columnLabel);
        leftContent.appendChild(labelSpan);
        
        // Group count
        const groupCountSpan = document.createElement('span');
        groupCountSpan.className = 'group-count';
        groupCountSpan.innerHTML = `&nbsp;(${groupCount})`;
        groupCountSpan.style.opacity = '0.8';
        groupCountSpan.style.fontSize = '0.9em';
        groupCountSpan.style.fontWeight = 'normal';
        groupCountSpan.title = `${groupCount} distinct value${groupCount === 1 ? '' : 's'} in ${this.stripHtmlTags(columnLabel)}`;
        leftContent.appendChild(groupCountSpan);
      } else {
        // Regular label (not grouped)
        const labelSpan = document.createElement('span');
        labelSpan.innerHTML = col.label || col.field;
        labelSpan.title = this.stripHtmlTags(col.label || col.field);
        leftContent.appendChild(labelSpan);
      }
      
      subHeader.appendChild(leftContent);
      
      // Right-aligned content wrapper
      const rightContent = document.createElement('div');
      rightContent.style.display = 'flex';
      rightContent.style.alignItems = 'center';
      rightContent.style.gap = '4px';
      
      // Grouping indicator
      if (col.groupable !== false && !col.hidden) {
        const groupIndicator = document.createElement('span');
        groupIndicator.className = 'group-indicator';
        if (this.groupByField === col.field) {
          groupIndicator.classList.add('grouped');
        }
        groupIndicator.textContent = this.groupByField === col.field ? '☴' : '☷';
        groupIndicator.style.cursor = 'pointer';
        groupIndicator.style.fontSize = '1em';
        const columnTitle = this.stripHtmlTags(col.label || col.field);
        groupIndicator.title = this.groupByField === col.field ? `Grouped by ${columnTitle} (click to ungroup)` : `Click to group by ${columnTitle}`;
        
        groupIndicator.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.groupByField === col.field) {
            this.group('');
          } else {
            this.group(col.field);
          }
        });
        
        rightContent.appendChild(groupIndicator);
      }
      
      // Add sort indicator
      const sortIndicator = document.createElement('span');
      sortIndicator.className = 'sort-indicator';
      sortIndicator.style.marginLeft = '4px';
      
      if (this.sortColumn === col.field) {
        sortIndicator.classList.add('active');
        
        // Check if this is a grouped field to show special indicators
        const isGroupedField = this.groupByField && col.field === this.groupByField;
        
        if (isGroupedField && this.sortMode === 'count') {
          sortIndicator.textContent = this.sortDirection === 'asc' ? '↑1' : '↓9';
        } else if (isGroupedField && this.sortMode === 'value') {
          sortIndicator.textContent = this.sortDirection === 'asc' ? '↑A' : '↓Z';
        } else {
          sortIndicator.textContent = this.sortDirection === 'asc' ? '↑' : '↓';
        }
        
        subHeader.classList.add('sorted', this.sortDirection);
      } else {
        sortIndicator.textContent = '⇅';
      }
      
      rightContent.appendChild(sortIndicator);
      subHeader.appendChild(rightContent);
      
      // Click handler for sorting
      subHeader.addEventListener('click', (e) => {
        const isGroupControl = e.target.classList.contains('group-indicator') ||
                              e.target.classList.contains('group-toggle-all') ||
                              e.target.closest('.group-indicator') ||
                              e.target.closest('.group-toggle-all');
        if (!isGroupControl) {
          this.sort(col.field);
        }
      });
      
      headerCell.appendChild(subHeader);
    });
  }

  renderBody() {
    // Disconnect lazy rendering observer before clearing content
    if (this.rowObserver) {
      this.rowObserver.disconnect();
    }
    
    // Handle fixed columns layout
    if (this.fixedColumns > 0) {
      this.renderBodyWithFixedColumns();
      return;
    }
    
    this.bodyContainer.innerHTML = '';

    // Show loading placeholders if in loading state
    if (this.isLoadingState) {
      this.showLoadingPlaceholders();
      return;
    }

    // Apply selection filter on top of existing filters
    let dataToRender = this.filteredData;
    
    // If filter is active but no rows are selected, turn off the filter automatically
    if (this.showOnlySelected && this.selectedRows.size === 0) {
      this.showOnlySelected = false;
      console.log('👁️ No rows selected - automatically showing all rows');
    }
    
    if (this.showOnlySelected && this.selectedRows.size > 0) {
      dataToRender = this.filteredData.filter(item => {
        const itemId = String(item[this.primaryKeyField]);
        return this.selectedRows.has(itemId);
      });
    }

    if (dataToRender.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'div-table-empty';
      emptyState.textContent = this.showOnlySelected && this.selectedRows.size > 0 
        ? 'No selected rows match current filters'
        : 'No data to display';
      this.bodyContainer.appendChild(emptyState);
      return;
    }

    if (this.groupByField) {
      this.renderGroupedRows(dataToRender);
    } else {
      this.renderRegularRows(dataToRender);
    }
    
    // Add header summary row if enabled and has aggregate columns
    if (this.showHeaderSummary && this.hasAggregateColumns()) {
      const summaryRow = this.createHeaderSummaryRow(dataToRender);
      // Insert at the beginning of body container (after header)
      this.bodyContainer.insertBefore(summaryRow, this.bodyContainer.firstChild);
    }
    
    // Setup lazy cell rendering observer if enabled
    if (this.lazyCellRendering) {
      this.setupLazyRenderingObserver();
    }
  }

  renderBodyWithFixedColumns() {
    // Preserve horizontal scroll position before clearing
    const scrollLeft = this.scrollBodyContainer?.scrollLeft || 0;
    
    this.fixedBodyContainer.innerHTML = '';
    this.scrollBodyContainer.innerHTML = '';

    // Show loading placeholders if in loading state
    if (this.isLoadingState) {
      this.showLoadingPlaceholders();
      return;
    }

    // Apply selection filter on top of existing filters
    let dataToRender = this.filteredData;
    
    if (this.showOnlySelected && this.selectedRows.size === 0) {
      this.showOnlySelected = false;
    }
    
    if (this.showOnlySelected && this.selectedRows.size > 0) {
      dataToRender = this.filteredData.filter(item => {
        const itemId = String(item[this.primaryKeyField]);
        return this.selectedRows.has(itemId);
      });
    }

    if (dataToRender.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'div-table-empty';
      emptyState.textContent = this.showOnlySelected && this.selectedRows.size > 0 
        ? 'No selected rows match current filters'
        : 'No data to display';
      // Span empty state across both sections
      this.fixedBodyContainer.appendChild(emptyState);
      return;
    }

    if (this.groupByField) {
      this.renderGroupedRowsWithFixedColumns(dataToRender);
    } else {
      this.renderRegularRowsWithFixedColumns(dataToRender);
    }
    
    // Add header summary row if enabled and has aggregate columns
    if (this.showHeaderSummary && this.hasAggregateColumns()) {
      const { fixedSummary, scrollSummary } = this.createHeaderSummaryRowWithFixedColumns(dataToRender);
      // Insert at the beginning of body containers (after header)
      this.fixedBodyContainer.insertBefore(fixedSummary, this.fixedBodyContainer.firstChild);
      this.scrollBodyContainer.insertBefore(scrollSummary, this.scrollBodyContainer.firstChild);
    }
    
    // Synchronize column widths in scroll section (must be done before row heights)
    this.syncFixedColumnsColumnWidths();
    
    // Synchronize row heights between fixed and scroll sections
    this.syncFixedColumnsRowHeights();
    
    // Setup lazy cell rendering observer if enabled
    if (this.lazyCellRendering) {
      this.setupLazyRenderingObserver();
    }
    
    // Restore horizontal scroll position after rendering
    if (scrollLeft > 0) {
      requestAnimationFrame(() => {
        this.scrollBodyContainer.scrollLeft = scrollLeft;
      });
    }
    
    // Adjust fixed body padding for horizontal scrollbar (after content is rendered)
    requestAnimationFrame(() => {
      this.adjustFixedBodyForHorizontalScrollbar();
    });
  }

  renderRegularRowsWithFixedColumns(dataToRender = this.filteredData) {
    const sortedData = this.sortData(dataToRender);
    
    sortedData.forEach(item => {
      const { fixedRow, scrollRow } = this.createRowWithFixedColumns(item);
      this.fixedBodyContainer.appendChild(fixedRow);
      this.scrollBodyContainer.appendChild(scrollRow);
    });
  }

  renderGroupedRowsWithFixedColumns(dataToRender = this.filteredData) {
    let groups = this.groupData(dataToRender);
    
    // If sorting by the grouped column, sort the groups themselves
    if (this.sortColumn === this.groupByField) {
      groups = groups.sort((a, b) => {
        if (this.sortMode === 'count') {
          const countDiff = a.items.length - b.items.length;
          return this.sortDirection === 'desc' ? -countDiff : countDiff;
        } else {
          if (a.value == null && b.value == null) return 0;
          if (a.value == null) return this.sortDirection === 'asc' ? -1 : 1;
          if (b.value == null) return this.sortDirection === 'asc' ? 1 : -1;
          
          let result = 0;
          if (typeof a.value === 'number' && typeof b.value === 'number') {
            result = a.value - b.value;
          } else {
            result = String(a.value).localeCompare(String(b.value));
          }
          
          return this.sortDirection === 'desc' ? -result : result;
        }
      });
    }
    
    groups.forEach(group => {
      if (this.sortColumn !== this.groupByField) {
        group.items = this.sortData(group.items);
      }
      
      // Group header spans both sections
      const { fixedGroupHeader, scrollGroupHeader } = this.createGroupHeaderWithFixedColumns(group);
      this.fixedBodyContainer.appendChild(fixedGroupHeader);
      this.scrollBodyContainer.appendChild(scrollGroupHeader);
      
      // Group rows (if not collapsed)
      if (!this.collapsedGroups.has(group.key)) {
        group.items.forEach(item => {
          const { fixedRow, scrollRow } = this.createRowWithFixedColumns(item);
          this.fixedBodyContainer.appendChild(fixedRow);
          this.scrollBodyContainer.appendChild(scrollRow);
        });
      }
      
      // Add group summary row after group (visible even when collapsed)
      if (this.showGroupSummary && this.hasAggregateColumns()) {
        const { fixedSummary, scrollSummary } = this.createGroupSummaryRowWithFixedColumns(group);
        this.fixedBodyContainer.appendChild(fixedSummary);
        this.scrollBodyContainer.appendChild(scrollSummary);
      }
    });
  }

  /**
   * Setup IntersectionObserver for lazy cell rendering
   * Observes unpopulated rows and populates them when they enter the viewport
   */
  setupLazyRenderingObserver() {
    // Disconnect existing observer if any
    if (this.rowObserver) {
      this.rowObserver.disconnect();
    }
    
    // Check for IntersectionObserver support
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: populate all rows immediately
      console.warn('DivTable: IntersectionObserver not supported, falling back to eager rendering');
      this.populateAllUnpopulatedRows();
      return;
    }
    
    // Determine the root element for observation
    const rootElement = this.fixedColumns > 0 
      ? this.scrollBodyContainer 
      : this.bodyContainer;
    
    // Create observer with margin to pre-render rows slightly before visible
    this.rowObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const row = entry.target;
          
          // Only populate if not already done
          if (row.dataset.populated !== 'true') {
            const rowId = row.dataset.id;
            const item = this.findRowData(rowId);
            
            if (item) {
              // Handle fixed columns layout
              if (this.fixedColumns > 0) {
                // Find the corresponding row in the other container
                const isFixedRow = row.classList.contains('div-table-fixed-row');
                let fixedRow, scrollRow;
                
                if (isFixedRow) {
                  fixedRow = row;
                  scrollRow = this.scrollBodyContainer.querySelector(`.div-table-row[data-id="${rowId}"]`);
                } else {
                  scrollRow = row;
                  fixedRow = this.fixedBodyContainer.querySelector(`.div-table-row[data-id="${rowId}"]`);
                }
                
                if (fixedRow && scrollRow) {
                  this.populateRowCellsWithFixedColumns(fixedRow, scrollRow, item);
                }
              } else {
                this.populateRowCells(row, item);
              }
            }
          }
          
          // Unobserve after population
          this.rowObserver.unobserve(row);
        }
      });
    }, {
      root: rootElement,
      rootMargin: this.lazyRenderMargin, // Pre-render before visible
      threshold: 0
    });
    
    // Observe all unpopulated rows
    const rows = this.fixedColumns > 0 
      ? this.scrollBodyContainer.querySelectorAll('.div-table-row[data-populated="false"]')
      : this.bodyContainer.querySelectorAll('.div-table-row[data-populated="false"]');
    
    rows.forEach(row => {
      this.rowObserver.observe(row);
    });
    
    // Also observe in fixed section if using fixed columns
    if (this.fixedColumns > 0 && this.fixedBodyContainer) {
      const fixedRows = this.fixedBodyContainer.querySelectorAll('.div-table-row[data-populated="false"]');
      fixedRows.forEach(row => {
        this.rowObserver.observe(row);
      });
    }
  }
  
  /**
   * Fallback method to populate all unpopulated rows (when IntersectionObserver not available)
   */
  populateAllUnpopulatedRows() {
    const bodyContainer = this.fixedColumns > 0 ? this.scrollBodyContainer : this.bodyContainer;
    const rows = bodyContainer.querySelectorAll('.div-table-row[data-populated="false"]');
    
    rows.forEach(row => {
      const rowId = row.dataset.id;
      const item = this.findRowData(rowId);
      if (item) {
        this.populateRowCells(row, item);
      }
    });
  }

  renderRegularRows(dataToRender = this.filteredData) {
    const sortedData = this.sortData(dataToRender);
    
    sortedData.forEach(item => {
      const row = this.createRow(item);
      this.bodyContainer.appendChild(row);
    });
  }

  renderGroupedRows(dataToRender = this.filteredData) {
    let groups = this.groupData(dataToRender);
    
    // If sorting by the grouped column, sort the groups themselves
    if (this.sortColumn === this.groupByField) {
      groups = groups.sort((a, b) => {
        if (this.sortMode === 'count') {
          const countDiff = a.items.length - b.items.length;
          return this.sortDirection === 'desc' ? -countDiff : countDiff;
        } else {
          if (a.value == null && b.value == null) return 0;
          if (a.value == null) return this.sortDirection === 'asc' ? -1 : 1;
          if (b.value == null) return this.sortDirection === 'asc' ? 1 : -1;
          
          let result = 0;
          if (typeof a.value === 'number' && typeof b.value === 'number') {
            result = a.value - b.value;
          } else {
            result = String(a.value).localeCompare(String(b.value));
          }
          
          return this.sortDirection === 'desc' ? -result : result;
        }
      });
    }

    groups.forEach(group => {
      // Sort items within each group (unless sorting by grouped column, then no need to sort items)
      if (this.sortColumn !== this.groupByField) {
        group.items = this.sortData(group.items);
      }
      
      // Group header
      const groupHeader = this.createGroupHeader(group);
      this.bodyContainer.appendChild(groupHeader);
      
      // Group rows (if not collapsed)
      if (!this.collapsedGroups.has(group.key)) {
        group.items.forEach(item => {
          const row = this.createRow(item);
          this.bodyContainer.appendChild(row);
        });
      }
      
      // Add group summary row after group (visible even when collapsed)
      if (this.showGroupSummary && this.hasAggregateColumns()) {
        const groupSummary = this.createGroupSummaryRow(group);
        this.bodyContainer.appendChild(groupSummary);
      }
    });
  }

  /**
   * Populate cells for a row that was created as an empty shell (lazy rendering)
   * @param {HTMLElement} row - The row element to populate
   * @param {Object} item - The data item for this row
   */
  populateRowCells(row, item) {
    // Skip if already populated
    if (row.dataset.populated === 'true') return;
    
    const compositeColumns = this.getCompositeColumns();
    const rowId = String(item[this.primaryKeyField]);

    // Checkbox column
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-cell checkbox-column';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.selectedRows.has(rowId);
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        
        const rowData = this.findRowData(rowId);
        if (!rowData) {
          console.warn('DivTable: Could not find data for row ID:', rowId);
          return;
        }
        
        if (checkbox.checked) {
          if (!this.multiSelect) this.clearSelection();
          this.selectedRows.add(rowId);
          rowData.selected = true;
          row.classList.add('selected');
        } else {
          this.selectedRows.delete(rowId);
          rowData.selected = false;
          row.classList.remove('selected');
          
          if (this.showOnlySelected) {
            this.renderBody();
            this.updateInfoSection();
            
            const selectedData = Array.from(this.selectedRows)
              .map(id => this.findRowData(id))
              .filter(Boolean);
            
            if (typeof this.onSelectionChange === 'function') {
              this.onSelectionChange(selectedData);
            }
            return;
          }
        }
        
        this.updateSelectionStates();
        this.updateInfoSection();
        
        const selectedData = Array.from(this.selectedRows)
          .map(id => this.findRowData(id))
          .filter(Boolean);
        
        if (typeof this.onSelectionChange === 'function') {
          this.onSelectionChange(selectedData);
        }
      });
      
      checkbox.addEventListener('focus', (e) => {
        this.updateFocusState(row);
      });
      
      checkboxCell.appendChild(checkbox);
      
      checkboxCell.addEventListener('click', (e) => {
        if (e.target === checkbox) return;
        e.stopPropagation();
        checkbox.click();
      });
      
      row.appendChild(checkboxCell);
    }

    // Data columns - render using composite structure with proper alignment
    compositeColumns.forEach(composite => {
      const cell = this.createCellForComposite(composite, item);
      row.appendChild(cell);
    });

    // Mark as populated
    row.dataset.populated = 'true';
    
    // Update tab indexes after population
    this.updateTabIndexes();
  }

  /**
   * Populate cells for fixed columns layout (both fixed and scroll row parts)
   * @param {HTMLElement} fixedRow - The fixed row element
   * @param {HTMLElement} scrollRow - The scroll row element  
   * @param {Object} item - The data item for this row
   */
  populateRowCellsWithFixedColumns(fixedRow, scrollRow, item) {
    // Skip if already populated
    if (fixedRow.dataset.populated === 'true') return;
    
    const { fixedColumns, scrollColumns } = this.splitColumnsForFixedLayout();
    const rowId = String(item[this.primaryKeyField]);
    
    // Checkbox column (in fixed row only)
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-cell checkbox-column';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.selectedRows.has(rowId);
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        
        const rowData = this.findRowData(rowId);
        if (!rowData) {
          console.warn('DivTable: Could not find data for row ID:', rowId);
          return;
        }
        
        if (checkbox.checked) {
          if (!this.multiSelect) this.clearSelection();
          this.selectedRows.add(rowId);
          rowData.selected = true;
          fixedRow.classList.add('selected');
          scrollRow.classList.add('selected');
        } else {
          this.selectedRows.delete(rowId);
          rowData.selected = false;
          fixedRow.classList.remove('selected');
          scrollRow.classList.remove('selected');
          
          if (this.showOnlySelected) {
            this.renderBody();
            this.updateInfoSection();
            
            const selectedData = Array.from(this.selectedRows)
              .map(id => this.findRowData(id))
              .filter(Boolean);
            
            if (typeof this.onSelectionChange === 'function') {
              this.onSelectionChange(selectedData);
            }
            return;
          }
        }
        
        this.updateSelectionStates();
        this.updateInfoSection();
        
        const selectedData = Array.from(this.selectedRows)
          .map(id => this.findRowData(id))
          .filter(Boolean);
        
        if (typeof this.onSelectionChange === 'function') {
          this.onSelectionChange(selectedData);
        }
      });
      
      checkbox.addEventListener('focus', (e) => {
        this.updateFocusStateForFixedRows(fixedRow, scrollRow);
      });
      
      checkboxCell.appendChild(checkbox);
      
      checkboxCell.addEventListener('click', (e) => {
        if (e.target === checkbox) return;
        e.stopPropagation();
        checkbox.click();
      });
      
      fixedRow.appendChild(checkboxCell);
    }
    
    // Render fixed columns
    fixedColumns.forEach(composite => {
      const cell = this.createCellForComposite(composite, item);
      fixedRow.appendChild(cell);
    });
    
    // Render scrollable columns
    scrollColumns.forEach(composite => {
      const cell = this.createCellForComposite(composite, item);
      scrollRow.appendChild(cell);
    });
    
    // Mark as populated
    fixedRow.dataset.populated = 'true';
    scrollRow.dataset.populated = 'true';
    
    // Synchronize heights between fixed and scroll row parts after cell population
    // Use double requestAnimationFrame to ensure layout is fully complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Reset any fixed heights to get natural content height
        fixedRow.style.height = '';
        scrollRow.style.height = '';
        
        // Get the maximum height from both rows, including any cell content
        // Use scrollHeight to capture content that might overflow
        const fixedHeight = Math.max(fixedRow.offsetHeight, fixedRow.scrollHeight);
        const scrollHeight = Math.max(scrollRow.offsetHeight, scrollRow.scrollHeight);
        
        // Also check individual cell heights
        let maxCellHeight = 0;
        fixedRow.querySelectorAll('.div-table-cell').forEach(cell => {
          maxCellHeight = Math.max(maxCellHeight, cell.offsetHeight, cell.scrollHeight);
        });
        scrollRow.querySelectorAll('.div-table-cell').forEach(cell => {
          maxCellHeight = Math.max(maxCellHeight, cell.offsetHeight, cell.scrollHeight);
        });
        
        const maxHeight = Math.max(fixedHeight, scrollHeight, maxCellHeight);
        if (maxHeight > 0) {
          fixedRow.style.height = `${maxHeight}px`;
          scrollRow.style.height = `${maxHeight}px`;
        }
      });
    });
    
    // Update tab indexes after population
    this.updateTabIndexes();
  }

  createRow(item) {
    const row = document.createElement('div');
    row.className = 'div-table-row';
    row.dataset.id = item[this.primaryKeyField];
    // Don't set tabindex here - will be managed by updateTabIndexes() based on checkbox presence
    
    const compositeColumns = this.getCompositeColumns();
    
    // Build grid template matching the header
    let gridTemplate = '';
    if (this.showCheckboxes) {
      gridTemplate = '40px '; // Checkbox column
    }
    
    // Add column templates for each composite group
    compositeColumns.forEach(composite => {
      const firstCol = composite.columns[0];
      const responsive = firstCol.responsive || {};
      switch (responsive.size) {
        case 'fixed-narrow':
          gridTemplate += '80px ';
          break;
        case 'fixed-medium':
          gridTemplate += '120px ';
          break;
        case 'flexible-small':
          gridTemplate += '1fr ';
          break;
        case 'flexible-medium':
          gridTemplate += '2fr ';
          break;
        case 'flexible-large':
          gridTemplate += '3fr ';
          break;
        default:
          gridTemplate += '1fr ';
      }
    });
    
    row.style.gridTemplateColumns = gridTemplate.trim();

    // Selection state
    const rowId = String(item[this.primaryKeyField]);
    if (this.selectedRows.has(rowId)) {
      row.classList.add('selected');
    }
    if (this.focusedRowId === rowId) {
      row.classList.add('focused');
    }

    // If lazy cell rendering is enabled, create empty shell and defer cell creation
    if (this.lazyCellRendering) {
      // Set minimum height to prevent layout shift
      row.style.minHeight = this.estimatedRowHeight + 'px';
      row.dataset.populated = 'false';
      
      // Row click handler - populate cells first if needed
      row.addEventListener('click', (e) => {
        // Populate cells if not yet done
        if (row.dataset.populated !== 'true') {
          this.populateRowCells(row, item);
        }
        
        // Only handle focus if not clicking on checkbox column
        if (e.target.closest('.checkbox-column')) return;
        
        const selection = window.getSelection();
        if (selection.toString().length > 0) return;
        
        const focusableElement = this.getFocusableElementForRow(row);
        if (focusableElement) {
          const currentFocused = this.getCurrentFocusedElement();
          if (currentFocused === focusableElement) return;
          
          const focusableElements = this.getAllFocusableElements();
          const focusIndex = focusableElements.indexOf(focusableElement);
          
          if (focusIndex !== -1) {
            this.focusElementAtIndex(focusIndex);
          }
        }
      });

      row.addEventListener('focus', (e) => {
        // Populate cells if not yet done
        if (row.dataset.populated !== 'true') {
          this.populateRowCells(row, item);
        }
        this.updateFocusState(row);
      });

      return row;
    }

    // Non-lazy rendering: create cells immediately (original behavior)
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-cell checkbox-column';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.selectedRows.has(rowId);
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        
        // Verify that the row data exists before proceeding
        const rowData = this.findRowData(rowId);
        if (!rowData) {
          console.warn('DivTable: Could not find data for row ID:', rowId);
          return;
        }
        
        if (checkbox.checked) {
          if (!this.multiSelect) this.clearSelection();
          this.selectedRows.add(rowId);
          rowData.selected = true;
          row.classList.add('selected');
        } else {
          this.selectedRows.delete(rowId);
          rowData.selected = false;
          row.classList.remove('selected');
          
          // If filter is active and we just deselected a row, re-render to remove it from view
          if (this.showOnlySelected) {
            // Re-render the body to update the filtered view
            this.renderBody();
            // Update info section after render
            this.updateInfoSection();
            
            // Trigger selection change callback
            const selectedData = Array.from(this.selectedRows)
              .map(id => this.findRowData(id))
              .filter(Boolean);
            
            if (typeof this.onSelectionChange === 'function') {
              this.onSelectionChange(selectedData);
            }
            
            // Early return since we already updated everything
            return;
          }
        }
        
        // Update all checkbox states (group and header)
        this.updateSelectionStates();
        this.updateInfoSection();
        
        // Ensure we only return valid data objects
        const selectedData = Array.from(this.selectedRows)
          .map(id => this.findRowData(id))
          .filter(Boolean);
        
        if (typeof this.onSelectionChange === 'function') {
          this.onSelectionChange(selectedData);
        }
      });
      
      // Sync checkbox focus with row focus
      checkbox.addEventListener('focus', (e) => {
        this.updateFocusState(row);
      });
      
      checkbox.addEventListener('blur', (e) => {
        // Optionally handle blur if needed - for now, keep row focused
        // This allows arrow key navigation to continue working
      });
      
      checkboxCell.appendChild(checkbox);
      
      // Make the entire checkbox cell clickable
      checkboxCell.addEventListener('click', (e) => {
        // If clicked on the checkbox itself, let it handle naturally
        if (e.target === checkbox) return;
        
        // If clicked elsewhere in the cell, toggle the checkbox
        e.stopPropagation();
        checkbox.click();
      });
      
      row.appendChild(checkboxCell);
    }

    // Data columns - render using composite structure with proper alignment
    compositeColumns.forEach(composite => {
      const cell = this.createCellForComposite(composite, item);
      row.appendChild(cell);
    });

    // Row click handler - set focus index for clicked row
    row.addEventListener('click', (e) => {
      // Only handle focus if not clicking on checkbox column
      if (e.target.closest('.checkbox-column')) return;
      
      // Check if user is making a text selection
      const selection = window.getSelection();
      if (selection.toString().length > 0) {
        return; // Don't trigger focus if user is selecting text
      }
      
      // Find the focusable element for this row
      const focusableElement = this.getFocusableElementForRow(row);
      if (focusableElement) {
        // Check if this row already has focus
        const currentFocused = this.getCurrentFocusedElement();
        if (currentFocused === focusableElement) {
          return; // Don't trigger focus event if already focused
        }
        
        // Get all focusable elements and find the index of this element
        const focusableElements = this.getAllFocusableElements();
        const focusIndex = focusableElements.indexOf(focusableElement);
        
        if (focusIndex !== -1) {
          // Use the existing focus system to set focus to this index
          this.focusElementAtIndex(focusIndex);
        }
      }
    });

    // Row focus event to sync with tabIndex navigation
    row.addEventListener('focus', (e) => {
      this.updateFocusState(row);
    });

    return row;
  }

  createRowWithFixedColumns(item) {
    const { fixedColumns, scrollColumns } = this.splitColumnsForFixedLayout();
    const rowId = String(item[this.primaryKeyField]);
    
    // Create fixed row part
    const fixedRow = document.createElement('div');
    fixedRow.className = 'div-table-row div-table-fixed-row';
    fixedRow.dataset.id = rowId;
    
    // Build grid template for fixed row
    let fixedGridTemplate = '';
    if (this.showCheckboxes) {
      fixedGridTemplate = '40px ';
    }
    fixedColumns.forEach(composite => {
      fixedGridTemplate += this.getColumnGridSize(composite, true) + ' ';
    });
    fixedRow.style.gridTemplateColumns = fixedGridTemplate.trim();
    
    // Create scrollable row part
    const scrollRow = document.createElement('div');
    scrollRow.className = 'div-table-row div-table-scroll-row';
    scrollRow.dataset.id = rowId;
    
    // Build grid template for scrollable row
    let scrollGridTemplate = '';
    scrollColumns.forEach(composite => {
      scrollGridTemplate += this.getColumnGridSize(composite) + ' ';
    });
    scrollRow.style.gridTemplateColumns = scrollGridTemplate.trim();
    
    // Apply selection state to both row parts
    if (this.selectedRows.has(rowId)) {
      fixedRow.classList.add('selected');
      scrollRow.classList.add('selected');
    }
    if (this.focusedRowId === rowId) {
      fixedRow.classList.add('focused');
      scrollRow.classList.add('focused');
    }
    
    // If lazy cell rendering is enabled, create empty shells and defer cell creation
    if (this.lazyCellRendering) {
      fixedRow.style.minHeight = this.estimatedRowHeight + 'px';
      scrollRow.style.minHeight = this.estimatedRowHeight + 'px';
      fixedRow.dataset.populated = 'false';
      scrollRow.dataset.populated = 'false';
      
      // Row click handler - populate cells first if needed
      const handleRowClick = (e, targetRow) => {
        // Populate cells if not yet done
        if (fixedRow.dataset.populated !== 'true') {
          this.populateRowCellsWithFixedColumns(fixedRow, scrollRow, item);
        }
        
        if (e.target.closest('.checkbox-column')) return;
        
        const selection = window.getSelection();
        if (selection.toString().length > 0) return;
        
        const focusableElement = this.getFocusableElementForRow(fixedRow);
        if (focusableElement) {
          const focusableElements = this.getAllFocusableElements();
          const focusIndex = focusableElements.indexOf(focusableElement);
          if (focusIndex !== -1) {
            this.focusElementAtIndex(focusIndex);
          }
        }
      };
      
      fixedRow.addEventListener('click', (e) => handleRowClick(e, fixedRow));
      scrollRow.addEventListener('click', (e) => handleRowClick(e, scrollRow));
      
      fixedRow.addEventListener('focus', (e) => {
        if (fixedRow.dataset.populated !== 'true') {
          this.populateRowCellsWithFixedColumns(fixedRow, scrollRow, item);
        }
        this.updateFocusStateForFixedRows(fixedRow, scrollRow);
      });
      
      // Sync hover state between row parts
      fixedRow.addEventListener('mouseenter', () => scrollRow.classList.add('hover'));
      fixedRow.addEventListener('mouseleave', () => scrollRow.classList.remove('hover'));
      scrollRow.addEventListener('mouseenter', () => fixedRow.classList.add('hover'));
      scrollRow.addEventListener('mouseleave', () => fixedRow.classList.remove('hover'));
      
      return { fixedRow, scrollRow };
    }

    // Non-lazy rendering: create cells immediately (original behavior)
    // Checkbox column (in fixed row only)
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-cell checkbox-column';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.selectedRows.has(rowId);
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        
        const rowData = this.findRowData(rowId);
        if (!rowData) {
          console.warn('DivTable: Could not find data for row ID:', rowId);
          return;
        }
        
        if (checkbox.checked) {
          if (!this.multiSelect) this.clearSelection();
          this.selectedRows.add(rowId);
          rowData.selected = true;
          fixedRow.classList.add('selected');
          scrollRow.classList.add('selected');
        } else {
          this.selectedRows.delete(rowId);
          rowData.selected = false;
          fixedRow.classList.remove('selected');
          scrollRow.classList.remove('selected');
          
          if (this.showOnlySelected) {
            this.renderBody();
            this.updateInfoSection();
            
            const selectedData = Array.from(this.selectedRows)
              .map(id => this.findRowData(id))
              .filter(Boolean);
            
            if (typeof this.onSelectionChange === 'function') {
              this.onSelectionChange(selectedData);
            }
            return;
          }
        }
        
        this.updateSelectionStates();
        this.updateInfoSection();
        
        const selectedData = Array.from(this.selectedRows)
          .map(id => this.findRowData(id))
          .filter(Boolean);
        
        if (typeof this.onSelectionChange === 'function') {
          this.onSelectionChange(selectedData);
        }
      });
      
      checkbox.addEventListener('focus', (e) => {
        this.updateFocusStateForFixedRows(fixedRow, scrollRow);
      });
      
      checkboxCell.appendChild(checkbox);
      
      checkboxCell.addEventListener('click', (e) => {
        if (e.target === checkbox) return;
        e.stopPropagation();
        checkbox.click();
      });
      
      fixedRow.appendChild(checkboxCell);
    }
    
    // Render fixed columns
    fixedColumns.forEach(composite => {
      const cell = this.createCellForComposite(composite, item);
      fixedRow.appendChild(cell);
    });
    
    // Render scrollable columns
    scrollColumns.forEach(composite => {
      const cell = this.createCellForComposite(composite, item);
      scrollRow.appendChild(cell);
    });
    
    // Row click handlers for both parts
    const handleRowClick = (e, targetRow) => {
      if (e.target.closest('.checkbox-column')) return;
      
      const selection = window.getSelection();
      if (selection.toString().length > 0) return;
      
      const focusableElement = this.getFocusableElementForRow(fixedRow);
      if (focusableElement) {
        const focusableElements = this.getAllFocusableElements();
        const focusIndex = focusableElements.indexOf(focusableElement);
        if (focusIndex !== -1) {
          this.focusElementAtIndex(focusIndex);
        }
      }
    };
    
    fixedRow.addEventListener('click', (e) => handleRowClick(e, fixedRow));
    scrollRow.addEventListener('click', (e) => handleRowClick(e, scrollRow));
    
    // Sync hover state between row parts
    fixedRow.addEventListener('mouseenter', () => {
      scrollRow.classList.add('hover');
    });
    fixedRow.addEventListener('mouseleave', () => {
      scrollRow.classList.remove('hover');
    });
    scrollRow.addEventListener('mouseenter', () => {
      fixedRow.classList.add('hover');
    });
    scrollRow.addEventListener('mouseleave', () => {
      fixedRow.classList.remove('hover');
    });
    
    return { fixedRow, scrollRow };
  }

  updateFocusStateForFixedRows(fixedRow, scrollRow) {
    // Clear previous focus classes in both containers
    this.fixedBodyContainer.querySelectorAll('.div-table-row.focused').forEach(r => r.classList.remove('focused'));
    this.scrollBodyContainer.querySelectorAll('.div-table-row.focused').forEach(r => r.classList.remove('focused'));
    
    // Set focus on both parts
    fixedRow.classList.add('focused');
    scrollRow.classList.add('focused');
    
    const rowId = fixedRow.dataset.id;
    if (rowId) {
      this.focusedRowId = rowId;
      
      if (this._lastFocusCallback.rowId !== rowId) {
        this._lastFocusCallback = { rowId: rowId, groupKey: null };
        const rowData = this.findRowData(rowId);
        this.onRowFocus(rowData);
      }
    }
  }

  createCellForComposite(composite, item) {
    const cell = document.createElement('div');
    cell.className = 'div-table-cell';
    
    // Apply text alignment from column config (single column only)
    if (!composite.compositeName && composite.columns[0]?.align) {
      cell.style.textAlign = composite.columns[0].align;
      cell.style.justifyContent = composite.columns[0].align === 'right' ? 'flex-end' : 
                                   composite.columns[0].align === 'center' ? 'center' : 'flex-start';
    }
    
    if (composite.compositeName) {
      // Composite cell with multiple columns stacked vertically
      cell.classList.add('composite-cell');
      
      composite.columns.forEach((col, index) => {
        const subCell = document.createElement('div');
        subCell.className = 'composite-sub-cell';
        
        if (this.groupByField && col.field === this.groupByField) {
          subCell.classList.add('grouped-column');
          subCell.textContent = '';
        } else {
          if (col.subField) {
            subCell.classList.add('composite-column');
            subCell.style.display = 'flex';
            subCell.style.flexDirection = 'column';
            subCell.style.gap = '2px';
            
            const mainDiv = document.createElement('div');
            mainDiv.className = 'composite-main';
            if (typeof col.render === 'function') {
              mainDiv.innerHTML = col.render(item[col.field], item);
            } else {
              mainDiv.innerHTML = item[col.field] ?? '';
            }
            // Set title for tooltip on main content
            mainDiv.title = this.stripHtmlTags(mainDiv.innerHTML);
            
            const subDiv = document.createElement('div');
            subDiv.className = 'composite-sub';
            if (typeof col.subRender === 'function') {
              subDiv.innerHTML = col.subRender(item[col.subField], item);
            } else {
              subDiv.innerHTML = item[col.subField] ?? '';
            }
            // Set title for tooltip on sub content
            subDiv.title = this.stripHtmlTags(subDiv.innerHTML);
            
            subCell.appendChild(mainDiv);
            subCell.appendChild(subDiv);
          } else {
            if (typeof col.render === 'function') {
              subCell.innerHTML = col.render(item[col.field], item);
            } else {
              subCell.innerHTML = item[col.field] ?? '';
            }
            // Set title for tooltip on sub-cell
            subCell.title = this.stripHtmlTags(subCell.innerHTML);
          }
        }
        
        cell.appendChild(subCell);
      });
    } else {
      // Single column
      const col = composite.columns[0];
      
      if (this.groupByField && col.field === this.groupByField) {
        cell.classList.add('grouped-column');
        cell.textContent = '';
      } else {
        if (col.subField) {
          cell.classList.add('composite-column');
          
          const mainDiv = document.createElement('div');
          mainDiv.className = 'composite-main';
          if (typeof col.render === 'function') {
            mainDiv.innerHTML = col.render(item[col.field], item);
          } else {
            mainDiv.innerHTML = item[col.field] ?? '';
          }
          // Set title for tooltip on main content
          mainDiv.title = this.stripHtmlTags(mainDiv.innerHTML);
          
          const subDiv = document.createElement('div');
          subDiv.className = 'composite-sub';
          if (typeof col.subRender === 'function') {
            subDiv.innerHTML = col.subRender(item[col.subField], item);
          } else {
            subDiv.innerHTML = item[col.subField] ?? '';
          }
          // Set title for tooltip on sub content
          subDiv.title = this.stripHtmlTags(subDiv.innerHTML);
          
          cell.appendChild(mainDiv);
          cell.appendChild(subDiv);
        } else {
          // Wrap content in a span for proper flex alignment
          const contentSpan = document.createElement('span');
          contentSpan.className = 'cell-content';
          if (typeof col.render === 'function') {
            contentSpan.innerHTML = col.render(item[col.field], item);
          } else {
            contentSpan.innerHTML = item[col.field] ?? '';
          }
          // Set title for tooltip
          contentSpan.title = this.stripHtmlTags(contentSpan.innerHTML);
          cell.appendChild(contentSpan);
        }
      }
    }
    
    return cell;
  }

  createGroupHeaderWithFixedColumns(group) {
    const { fixedColumns, scrollColumns } = this.splitColumnsForFixedLayout();
    
    // Create fixed group header part
    const fixedGroupHeader = document.createElement('div');
    fixedGroupHeader.className = 'div-table-row group-header div-table-fixed-row';
    fixedGroupHeader.dataset.groupKey = group.key;
    
    // Build grid template for fixed section
    let fixedGridTemplate = '';
    if (this.showCheckboxes) {
      fixedGridTemplate = '40px ';
    }
    fixedColumns.forEach(composite => {
      fixedGridTemplate += this.getColumnGridSize(composite, true) + ' ';
    });
    fixedGroupHeader.style.gridTemplateColumns = fixedGridTemplate.trim();
    
    // Create scrollable group header part
    const scrollGroupHeader = document.createElement('div');
    scrollGroupHeader.className = 'div-table-row group-header div-table-scroll-row';
    scrollGroupHeader.dataset.groupKey = group.key;
    
    // Build grid template for scrollable section
    let scrollGridTemplate = '';
    scrollColumns.forEach(composite => {
      scrollGridTemplate += this.getColumnGridSize(composite) + ' ';
    });
    scrollGroupHeader.style.gridTemplateColumns = scrollGridTemplate.trim();
    
    if (this.collapsedGroups.has(group.key)) {
      fixedGroupHeader.classList.add('collapsed');
      scrollGroupHeader.classList.add('collapsed');
    }
    
    // Checkbox column for group (in fixed section only)
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-cell checkbox-column';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      
      const groupItemIds = group.items.map(item => String(item[this.primaryKeyField]));
      const selectedInGroup = groupItemIds.filter(id => this.selectedRows.has(id));
      
      if (selectedInGroup.length === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
      } else if (selectedInGroup.length === groupItemIds.length) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
      } else {
        checkbox.checked = false;
        checkbox.indeterminate = true;
      }
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        
        const currentlySelectedInGroup = groupItemIds.filter(id => this.selectedRows.has(id)).length;
        const shouldSelect = currentlySelectedInGroup === 0;
        
        group.items.forEach(item => {
          const itemId = String(item[this.primaryKeyField]);
          if (shouldSelect) {
            this.selectedRows.add(itemId);
            item.selected = true;
          } else {
            this.selectedRows.delete(itemId);
            item.selected = false;
          }
        });
        
        if (this.showOnlySelected) {
          this.renderBody();
          this.updateInfoSection();
          
          if (typeof this.onSelectionChange === 'function') {
            this.onSelectionChange(Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean));
          }
          return;
        }
        
        this.updateSelectionStates();
        this.updateInfoSection();
        
        if (typeof this.onSelectionChange === 'function') {
          this.onSelectionChange(Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean));
        }
      });
      
      checkbox.addEventListener('focus', (e) => {
        this.updateFocusStateForFixedRows(fixedGroupHeader, scrollGroupHeader);
      });
      
      checkboxCell.appendChild(checkbox);
      fixedGroupHeader.appendChild(checkboxCell);
    }
    
    // Group label cell spans remaining fixed columns
    const fixedLabelCell = document.createElement('div');
    fixedLabelCell.className = 'div-table-cell';
    fixedLabelCell.style.gridColumn = this.showCheckboxes ? '2 / -1' : '1 / -1';
    fixedLabelCell.style.display = 'flex';
    fixedLabelCell.style.alignItems = 'center';
    fixedLabelCell.style.gap = '8px';
    
    // Individual group toggle button
    const toggleBtn = document.createElement('span');
    toggleBtn.className = 'group-toggle';
    if (this.collapsedGroups.has(group.key)) {
      toggleBtn.classList.add('collapsed');
    }
    toggleBtn.textContent = '❯';
    toggleBtn.title = this.collapsedGroups.has(group.key) ? 'Expand group' : 'Collapse group';
    
    const groupColumn = this.columns.find(col => col.field === this.groupByField);
    const groupLabel = groupColumn?.label || this.groupByField;
    
    let renderedGroupValue;
    if (group.value == null || group.value === '') {
      renderedGroupValue = `${groupLabel} is undefined`;
    } else if (groupColumn && typeof groupColumn.render === 'function') {
      renderedGroupValue = groupColumn.render(group.value, null);
    } else {
      renderedGroupValue = group.value;
    }
    
    fixedLabelCell.appendChild(toggleBtn);
    
    if (this.groupRender) {
      // Custom group header rendering
      const customSpan = document.createElement('span');
      customSpan.innerHTML = this.groupRender({
        field: this.groupByField,
        value: group.value,
        displayValue: renderedGroupValue,
        count: group.items.length,
        items: group.items,
        collapsed: this.collapsedGroups.has(group.key)
      });
      fixedLabelCell.appendChild(customSpan);
    } else {
      const textSpan = document.createElement('span');
      if (typeof renderedGroupValue === 'string') {
        textSpan.innerHTML = renderedGroupValue;
      } else {
        textSpan.textContent = renderedGroupValue;
      }
      fixedLabelCell.appendChild(textSpan);
      
      const countSpan = document.createElement('span');
      countSpan.className = 'group-item-count';
      countSpan.innerHTML = `(${group.items.length})`;
      countSpan.style.opacity = '0.8';
      countSpan.style.fontSize = '0.9em';
      countSpan.style.fontWeight = 'normal';
      countSpan.title = `${group.items.length} item${group.items.length === 1 ? '' : 's'} in this group`;
      fixedLabelCell.appendChild(countSpan);
    }
    
    fixedGroupHeader.appendChild(fixedLabelCell);
    
    // Scrollable section gets an empty spanning cell
    const scrollLabelCell = document.createElement('div');
    scrollLabelCell.className = 'div-table-cell';
    scrollLabelCell.style.gridColumn = '1 / -1';
    scrollGroupHeader.appendChild(scrollLabelCell);
    
    // Group toggle click handler
    const handleToggleClick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      if (this.collapsedGroups.has(group.key)) {
        this.collapsedGroups.delete(group.key);
        fixedGroupHeader.classList.remove('collapsed');
        scrollGroupHeader.classList.remove('collapsed');
      } else {
        this.collapsedGroups.add(group.key);
        fixedGroupHeader.classList.add('collapsed');
        scrollGroupHeader.classList.add('collapsed');
      }
      this.render();
    };
    
    toggleBtn.addEventListener('click', handleToggleClick);
    
    // Sync hover state between group header parts
    fixedGroupHeader.addEventListener('mouseenter', () => {
      scrollGroupHeader.classList.add('hover');
    });
    fixedGroupHeader.addEventListener('mouseleave', () => {
      scrollGroupHeader.classList.remove('hover');
    });
    scrollGroupHeader.addEventListener('mouseenter', () => {
      fixedGroupHeader.classList.add('hover');
    });
    scrollGroupHeader.addEventListener('mouseleave', () => {
      fixedGroupHeader.classList.remove('hover');
    });
    
    return { fixedGroupHeader, scrollGroupHeader };
  }

  createGroupHeader(group) {
    const groupRow = document.createElement('div');
    groupRow.className = 'div-table-row group-header';
    groupRow.dataset.groupKey = group.key; // Store group key for identification
    
    const orderedColumns = this.getOrderedColumns();
    
    // Use the same grid template as header
    let gridTemplate = '';
    if (this.showCheckboxes) {
      gridTemplate = '40px '; // Checkbox column
    }
    
    // Add column templates
    orderedColumns.forEach(col => {
      const responsive = col.responsive || {};
      switch (responsive.size) {
        case 'fixed-narrow':
          gridTemplate += '80px ';
          break;
        case 'fixed-medium':
          gridTemplate += '120px ';
          break;
        case 'flexible-small':
          gridTemplate += '1fr ';
          break;
        case 'flexible-medium':
          gridTemplate += '2fr ';
          break;
        case 'flexible-large':
          gridTemplate += '3fr ';
          break;
        default:
          gridTemplate += '1fr ';
      }
    });
    
    groupRow.style.gridTemplateColumns = gridTemplate.trim();
    
    if (this.collapsedGroups.has(group.key)) {
      groupRow.classList.add('collapsed');
    }

    // Checkbox column for group (if enabled)
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-cell checkbox-column';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      
      // Determine checkbox state based on group items
      const groupItemIds = group.items.map(item => String(item[this.primaryKeyField]));
      const selectedInGroup = groupItemIds.filter(id => this.selectedRows.has(id));
      
      if (selectedInGroup.length === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
      } else if (selectedInGroup.length === groupItemIds.length) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
      } else {
        checkbox.checked = false;
        checkbox.indeterminate = true;
      }
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        
        // Determine what action to take based on current selection state
        // Check how many items in this group are currently selected
        const groupItemIds = group.items.map(item => String(item[this.primaryKeyField]));
        const currentlySelectedInGroup = groupItemIds.filter(id => this.selectedRows.has(id)).length;
        
        // If all or some are selected, deselect all. If none are selected, select all.
        const shouldSelect = currentlySelectedInGroup === 0;
        
        // Select/deselect all items in the group
        group.items.forEach(item => {
          const itemId = String(item[this.primaryKeyField]);
          if (shouldSelect) {
            this.selectedRows.add(itemId);
            item.selected = true;
          } else {
            this.selectedRows.delete(itemId);
            item.selected = false;
          }
        });
        
        // If filter is active, always re-render to update the filtered view
        if (this.showOnlySelected) {
          this.renderBody();
          this.updateInfoSection();
          
          // Trigger selection change callback
          if (typeof this.onSelectionChange === 'function') {
            this.onSelectionChange(Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean));
          }
          return;
        }
        
        // Update visual states for all rows
        this.updateSelectionStates();
        this.updateInfoSection();
        
        // Trigger selection change callback
        if (typeof this.onSelectionChange === 'function') {
          this.onSelectionChange(Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean));
        }
      });
      
      // Add focus handler for group header checkbox
      checkbox.addEventListener('focus', (e) => {
        this.updateFocusState(groupRow);
      });
      
      checkboxCell.appendChild(checkbox);
      groupRow.appendChild(checkboxCell);
    }

    // Group label cell (spans remaining columns)
    const cell = document.createElement('div');
    cell.className = 'div-table-cell';
    cell.style.gridColumn = this.showCheckboxes ? '2 / -1' : '1 / -1'; // Span from after checkbox to end
    cell.style.display = 'flex';
    cell.style.alignItems = 'center';
    cell.style.gap = '8px';
    
    // Individual group toggle button
    const toggleBtn = document.createElement('span');
    toggleBtn.className = 'group-toggle';
    if (this.collapsedGroups.has(group.key)) {
      toggleBtn.classList.add('collapsed');
    }
    toggleBtn.textContent = '❯';
    toggleBtn.title = this.collapsedGroups.has(group.key) ? 'Expand group' : 'Collapse group';
    
    const groupColumn = this.columns.find(col => col.field === this.groupByField);
    const groupLabel = groupColumn?.label || this.groupByField;
    
    // Use render function if available, otherwise use raw value
    let renderedGroupValue;
    if (group.value == null || group.value === '') {
      // Handle undefined/null/empty values
      renderedGroupValue = `${groupLabel} is undefined`;
    } else if (groupColumn && typeof groupColumn.render === 'function') {
      renderedGroupValue = groupColumn.render(group.value, null); // No specific row data for group headers
    } else {
      renderedGroupValue = group.value;
    }
    
    cell.appendChild(toggleBtn);
    
    if (this.groupRender) {
      // Custom group header rendering
      const customSpan = document.createElement('span');
      customSpan.innerHTML = this.groupRender({
        field: this.groupByField,
        value: group.value,
        displayValue: renderedGroupValue,
        count: group.items.length,
        items: group.items,
        collapsed: this.collapsedGroups.has(group.key)
      });
      cell.appendChild(customSpan);
    } else {
      // Create a span for the group text that can handle HTML
      const textSpan = document.createElement('span');
      if (typeof renderedGroupValue === 'string') {
        textSpan.innerHTML = renderedGroupValue;
      } else {
        textSpan.textContent = renderedGroupValue;
      }
      cell.appendChild(textSpan);
      
      // Add styled count span
      const countSpan = document.createElement('span');
      countSpan.className = 'group-item-count';
      countSpan.innerHTML = `(${group.items.length})`;
      countSpan.style.opacity = '0.8';
      countSpan.style.fontSize = '0.9em';
      countSpan.style.fontWeight = 'normal';
      countSpan.title = `${group.items.length} item${group.items.length === 1 ? '' : 's'} in this group`;
      cell.appendChild(countSpan);
    }
    
    groupRow.appendChild(cell);

    // Group toggle click handler - only handles expand/collapse
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      if (this.collapsedGroups.has(group.key)) {
        this.collapsedGroups.delete(group.key);
        groupRow.classList.remove('collapsed');
      } else {
        this.collapsedGroups.add(group.key);
        groupRow.classList.add('collapsed');
      }
      this.render();
      
      // After render, restore focus
      setTimeout(() => {
        const newGroupRow = this.bodyContainer.querySelector(`[data-group-key="${group.key}"]`);
        if (newGroupRow) {
          const focusableElement = this.getFocusableElementForRow(newGroupRow);
          if (focusableElement) {
            const focusableElements = this.getAllFocusableElements();
            const focusIndex = focusableElements.indexOf(focusableElement);
            if (focusIndex !== -1) {
              this.focusElementAtIndex(focusIndex);
            }
          }
        }
      }, 0);
    });

    // Group header click handler - only handles focus
    groupRow.addEventListener('click', (e) => {
      // Skip if clicking on checkbox column (checkbox handles its own logic)
      if (e.target.closest('.checkbox-column')) return;
      
      // Check if user is making a text selection
      const selection = window.getSelection();
      if (selection.toString().length > 0) {
        return; // Don't trigger focus if user is selecting text
      }
      
      // Set focus for any click on the group row
      const focusableElement = this.getFocusableElementForRow(groupRow);
      if (focusableElement) {
        // Check if this group row already has focus
        const currentFocused = this.getCurrentFocusedElement();
        if (currentFocused === focusableElement) {
          return; // Don't trigger focus event if already focused
        }
        
        const focusableElements = this.getAllFocusableElements();
        const focusIndex = focusableElements.indexOf(focusableElement);
        if (focusIndex !== -1) {
          this.focusElementAtIndex(focusIndex);
        }
      }
    });

    // Group header focus event to sync with tabIndex navigation
    groupRow.addEventListener('focus', (e) => {
      this.updateFocusState(groupRow);
    });

    return groupRow;
  }

  groupData(data) {
    const groups = new Map();
    
    data.forEach(item => {
      const value = item[this.groupByField];
      
      // Handle array values by joining them
      let key;
      let displayValue;
      if (Array.isArray(value)) {
        key = value.length > 0 ? value.join(', ') : '__null__';
        displayValue = value.length > 0 ? value.join(', ') : null;
      } else {
        key = value ?? '__null__';
        displayValue = value;
      }
      
      if (!groups.has(key)) {
        groups.set(key, { key, value: displayValue, items: [] });
      }
      groups.get(key).items.push(item);
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      return String(a.value).localeCompare(String(b.value));
    });
  }

  sortData(data) {
    if (!this.sortColumn) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[this.sortColumn];
      const bVal = b[this.sortColumn];
      
      if (aVal == null && bVal == null) return 0;
      
      // For undefined/null values:
      // - In ASC: nulls go to top (return -1 for null a, 1 for null b)
      // - In DESC: nulls go to bottom (return 1 for null a, -1 for null b)
      if (aVal == null) return this.sortDirection === 'asc' ? -1 : 1;
      if (bVal == null) return this.sortDirection === 'asc' ? 1 : -1;
      
      let result = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        result = aVal - bVal;
      } else {
        result = String(aVal).localeCompare(String(bVal));
      }
      
      return this.sortDirection === 'desc' ? -result : result;
    });
  }

  selectAll() {
    this.selectedRows.clear();
    this.filteredData.forEach(item => {
      const rowId = String(item[this.primaryKeyField]);
      this.selectedRows.add(rowId);
      item.selected = true;
    });
    this.updateSelectionStates();
    this.updateInfoSection();
    if (typeof this.onSelectionChange === 'function') {
      this.onSelectionChange(Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean));
    }
  }

  updateInfoSection() {
    if (!this.infoSection) return;
    
    // For virtual scrolling, use the max of totalRecords and actual loaded data
    // This handles cases where loaded data exceeds the reported total
    const total = this.virtualScrolling 
      ? Math.max(this.totalRecords, this.data.length) 
      : this.data.length;
    const loaded = this.data.length;
    const filtered = this.filteredData.length;
    // Count only valid selected rows (detail records, not stale IDs)
    const selected = this.getValidSelectedCount();
    
    // Clear existing content
    this.infoSection.innerHTML = '';
    
    // Create container for first line with refresh button
    const firstLineContainer = document.createElement('div');
    firstLineContainer.className = 'info-line-container';
    
    // First line: Selection info and filter button (only show when there are selections)
    // The button stays visible during loading as long as selectedRows is not empty
    if (selected > 0) {
      const selectionLine = document.createElement('div');
      selectionLine.className = 'info-line';
      
      // Add filter selected only toggle button BEFORE the selection count
      const filterSelectedOnlyToggleButton = this.createFilterSelectedOnlyToggleButton();
      selectionLine.appendChild(filterSelectedOnlyToggleButton);
      
      const selectionInfo = document.createElement('span');
      selectionInfo.className = 'info-selection';
      selectionInfo.textContent = `${selected} selected`;
      selectionLine.appendChild(selectionInfo);
      
      firstLineContainer.appendChild(selectionLine);
    }
    
    // Add auto-fetch button if enabled (only for virtual scrolling tables with more data to fetch)
    if (this.showAutoFetchButton && this.virtualScrolling && (this.hasMoreData || this.isAutoFetching)) {
      const autoFetchButton = this.createAutoFetchButton();
      
      // Button is always enabled if shown (either actively fetching or ready to fetch more)
      autoFetchButton.disabled = false;
      
      firstLineContainer.appendChild(autoFetchButton);
    }
    
    // Add refresh button if enabled - always in the first line container
    if (this.showRefreshButton) {
      const refreshButton = this.createRefreshButton();
      
      // Show loading state on refresh button for ANY loading operation
      // This provides consistent UI and visual feedback
      if (this.isLoading || this.isLoadingState) {
        refreshButton.classList.add('refreshing');
        refreshButton.disabled = true;
        refreshButton.title = 'Loading data...';
      } else {
        refreshButton.classList.remove('refreshing');
        refreshButton.disabled = false;
        refreshButton.title = 'Refresh data';
      }
      
      firstLineContainer.appendChild(refreshButton);
    }
    
    // Only add the container if it has content
    if (firstLineContainer.children.length > 0) {
      this.infoSection.appendChild(firstLineContainer);
    }
    
    // Second line: Stats (always shown) - smaller font
    const statsLine = document.createElement('div');
    statsLine.className = 'info-line secondary';
    
    const statsInfo = document.createElement('span');
    statsInfo.className = 'info-stats';
    
    let statsText = '';
    if (this.virtualScrolling) {
      // Virtual scrolling mode
      if (filtered < loaded) {
        // Has filtering applied
        if (loaded < total) {
          // Filtered and still loading: "2 filtered (15% of 13 total)"
          const loadPercentage = Math.round((loaded / total) * 100);
          statsText = `${filtered} filtered (${loadPercentage}% of ${total} total)`;
        } else {
          // Filtered and fully loaded: "2 filtered (13 total)"
          statsText = `${filtered} filtered (${total} total)`;
        }
      } else {
        // No filtering
        if (loaded < total) {
          const percentage = Math.round((loaded / total) * 100);
          statsText = `${percentage}% of ${total} total`;
        } else {
          statsText = `${total} total`;
        }
      }
    } else {
      // Regular mode
      if (filtered < total) {
        // Simple filtered format: "2 filtered (13 total)"
        statsText = `${filtered} filtered (${total} total)`;
      } else {
        statsText = `${total} total`;
      }
    }
    
    statsInfo.textContent = statsText;
    statsLine.appendChild(statsInfo);
    this.infoSection.appendChild(statsLine);
    
    // Third line: Visual progress bar
    this.createProgressBar(loaded, total, filtered);
  }

  createProgressBar(loaded, total, filtered) {
    const progressLine = document.createElement('div');
    progressLine.className = 'progress-line';
    
    // Always use current totalRecords for accurate calculations
    // This ensures correct shimmer size even when totalRecords changes during loading
    const currentTotal = this.virtualScrolling ? this.totalRecords : this.data.length;
    
    // Show progress bar only when not all data is loaded yet (hide when fully loaded)
    const showLoadingProgress = this.virtualScrolling && loaded < currentTotal;
    const showFilterProgress = filtered < currentTotal;
    
    if (showLoadingProgress || showFilterProgress) {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'loading-progress';
      
      // Calculate loading segment size with stable batch size that doesn't shrink with smaller totals
      // Use the larger of: pageSize, or percentage of current total, to maintain consistent shimmer size
      const percentageBased = Math.ceil(currentTotal * 0.1); // 10% of current total
      const pageBasedBatch = this.pageSize || 50; // Use configured page size or default 50
      const estimatedBatchSize = Math.max(pageBasedBatch, Math.min(percentageBased, 100)); // At least pageSize, max 100
      // Show loading segment when there's more data to load (not just when actively loading)
      const loadingSegmentEnd = loaded < currentTotal ? Math.min(currentTotal, loaded + estimatedBatchSize) : loaded;
      
      // Calculate percentages
      const filteredPercentage = (filtered / currentTotal) * 100;
      const loadedPercentage = (loaded / currentTotal) * 100;
      const loadingEndPercentage = (loadingSegmentEnd / currentTotal) * 100;
      
      // Only show red filtered segment when there's an actual query filter active
      // Don't show it for the selected-rows-only filter (that's a UI toggle, not a data filter)
      const hasQueryFilter = filtered < loaded && this.currentQuery && this.currentQuery.trim() !== '';
      
      // When there's a query filter active, show filtered (red) + loaded-not-filtered (gray)
      if (hasQueryFilter) {
        // Segment 1: Filtered records (red, opacity 1)
        if (filtered > 0) {
          const filteredBar = document.createElement('div');
          filteredBar.className = 'progress-segment filtered-segment';
          filteredBar.style.width = `${filteredPercentage}%`;
          filteredBar.style.opacity = '1';
          progressContainer.appendChild(filteredBar);
        }
        
        // Segment 2: Loaded but filtered out (gray, opacity 0.8)
        if (loaded > filtered) {
          const loadedNotFilteredBar = document.createElement('div');
          loadedNotFilteredBar.className = 'progress-segment loaded-segment';
          loadedNotFilteredBar.style.left = `${filteredPercentage}%`;
          loadedNotFilteredBar.style.width = `${loadedPercentage - filteredPercentage}%`;
          loadedNotFilteredBar.style.opacity = '0.8';
          progressContainer.appendChild(loadedNotFilteredBar);
        }
      } else {
        // No filter: just show all loaded data as loaded-segment (gray, opacity 1)
        if (loaded > 0) {
          const loadedBar = document.createElement('div');
          loadedBar.className = 'progress-segment loaded-segment';
          loadedBar.style.width = `${loadedPercentage}%`;
          loadedBar.style.opacity = '1';
          progressContainer.appendChild(loadedBar);
        }
      }
      
      // Segment 3: Loading next page (shimmer effect)
      // Only show when actively loading or auto-fetching (not paused)
      const shouldShowLoadingSegment = this.hasMoreData && 
                                       (this.isLoading || (this.isAutoFetching && !this.autoFetchPaused)) &&
                                       loaded < currentTotal && 
                                       loadingSegmentEnd > loaded;
      
      if (shouldShowLoadingSegment) {
        const loadingBar = document.createElement('div');
        loadingBar.className = 'progress-segment loading-segment';
        loadingBar.style.left = `${loadedPercentage}%`;
        loadingBar.style.width = `${loadingEndPercentage - loadedPercentage}%`;
        progressContainer.appendChild(loadingBar);
      }
      
      // Set state for CSS styling
      if (hasQueryFilter && showLoadingProgress) {
        progressContainer.setAttribute('data-state', 'filtered-loading');
      } else if (hasQueryFilter) {
        progressContainer.setAttribute('data-state', 'filtered');
      } else if (showLoadingProgress) {
        progressContainer.setAttribute('data-state', 'sequential-loading');
      }
      
      progressLine.appendChild(progressContainer);
      this.infoSection.appendChild(progressLine);
    }
  }

  createRefreshButton() {
    // Create refresh button container
    const refreshButton = document.createElement('button');
    refreshButton.className = 'refresh-button';
    refreshButton.type = 'button';
    refreshButton.title = 'Refresh data';
    refreshButton.setAttribute('aria-label', 'Refresh table data');
    
    // Add refresh icon (using SVG for better compatibility)
    refreshButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 4v6h-6"></path>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
      </svg>
    `;
    
    // Add click handler
    refreshButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Add visual feedback
      refreshButton.classList.add('refreshing');
      
      try {
        // Call the public refresh method
        await this.refresh();
      } catch (error) {
        // Error already logged in refresh() method
      } finally {
        // Remove visual feedback after a minimum duration
        setTimeout(() => {
          refreshButton.classList.remove('refreshing');
        }, 500);
      }
    });
    
    return refreshButton;
  }

  createAutoFetchButton() {
    // Create auto-fetch button container
    const autoFetchButton = document.createElement('button');
    autoFetchButton.className = 'auto-fetch-button';
    autoFetchButton.type = 'button';
    autoFetchButton.title = 'Auto-fetch all pages';
    autoFetchButton.setAttribute('aria-label', 'Automatically fetch all remaining pages');
    
    // Add play/pause icon (using SVG)
    const updateButtonIcon = (isPaused) => {
      if (this.isAutoFetching && !isPaused) {
        // Show pause icon when actively auto-fetching
        autoFetchButton.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        `;
        autoFetchButton.title = 'Pause auto-fetch';
        autoFetchButton.classList.add('active');
        autoFetchButton.classList.remove('paused');
      } else {
        // Show play icon when not auto-fetching or paused
        autoFetchButton.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        `;
        autoFetchButton.classList.remove('active');
        if (isPaused) {
          autoFetchButton.title = 'Resume auto-fetch (waiting for current page to complete)';
          autoFetchButton.classList.add('paused');
        } else {
          autoFetchButton.title = 'Auto-fetch all pages';
          autoFetchButton.classList.remove('paused');
        }
      }
    };
    
    // Initial icon - set based on current state
    updateButtonIcon(this.autoFetchPaused);
    
    // Add click handler
    autoFetchButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (this.isAutoFetching) {
        // Toggle pause/resume
        this.autoFetchPaused = !this.autoFetchPaused;
        updateButtonIcon(this.autoFetchPaused);
        
        if (!this.autoFetchPaused) {
          // Resume auto-fetching
          this.continueAutoFetch();
        }
      } else {
        // Start auto-fetching
        this.startAutoFetch(updateButtonIcon);
      }
    });
    
    // Store reference for updating icon from external methods
    this.autoFetchButton = autoFetchButton;
    this.updateAutoFetchButtonIcon = updateButtonIcon;
    
    return autoFetchButton;
  }

  async startAutoFetch(updateButtonIcon) {
    if (!this.virtualScrolling || !this.hasMoreData || this.isAutoFetching) {
      return;
    }
    
    this.isAutoFetching = true;
    this.autoFetchPaused = false;
    updateButtonIcon(false);
    
    console.log('🚀 Starting auto-fetch...');
    
    try {
      await this.continueAutoFetch();
    } catch (error) {
      console.error('❌ Auto-fetch error:', error);
      this.stopAutoFetch();
    }
  }

  async continueAutoFetch() {
    while (this.hasMoreData && this.isAutoFetching && !this.autoFetchPaused) {
      // Load next page (this will complete even if user pauses during the load)
      await this.loadNextPage();
      
      // Check if we should continue after the page completes
      // User may have paused during loadNextPage, so check again before scheduling delay
      if (!this.hasMoreData || !this.isAutoFetching || this.autoFetchPaused) {
        break;
      }
      
      // Wait for the specified delay before fetching the next page
      await new Promise(resolve => {
        this.autoFetchTimeout = setTimeout(resolve, this.autoFetchDelay);
      });
      
      // Check again after delay - user may have paused during the delay period
      if (this.autoFetchPaused) {
        break;
      }
    }
    
    // Auto-fetch completed or paused
    if (!this.hasMoreData) {
      this.stopAutoFetch();
    } else if (this.autoFetchPaused) {
      if (this.updateAutoFetchButtonIcon) {
        this.updateAutoFetchButtonIcon(true); // isPaused = true
      }
      this.updateInfoSection();
    }
  }

  stopAutoFetch() {
    this.isAutoFetching = false;
    this.autoFetchPaused = false;
    
    // Clear any pending timeout
    if (this.autoFetchTimeout) {
      clearTimeout(this.autoFetchTimeout);
      this.autoFetchTimeout = null;
    }
    
    // Update button icon if available
    if (this.updateAutoFetchButtonIcon) {
      this.updateAutoFetchButtonIcon(false);
      this.autoFetchButton?.classList.remove('active', 'paused');
    }
    
    this.updateInfoSection();
  }

  /**
   * Create filter selected only toggle button for showing only selected rows
   * @returns {HTMLButtonElement} The filter selected only toggle button element
   */
  createFilterSelectedOnlyToggleButton() {
    const filterButton = document.createElement('button');
    filterButton.className = 'filter-selected-only-toggle-button';
    filterButton.type = 'button';
    
    const updateButtonState = () => {
      if (this.showOnlySelected) {
        filterButton.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;
        filterButton.title = 'Show all rows';
        filterButton.classList.add('active');
      } else {
        filterButton.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;
        filterButton.title = 'Show only selected rows';
        filterButton.classList.remove('active');
      }
    };
    
    updateButtonState();
    
    filterButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Toggle the filter state
      this.showOnlySelected = !this.showOnlySelected;
      
      // Update button appearance
      updateButtonState();
      
      // Re-render the table with the new filter
      this.render();
      
      console.log(this.showOnlySelected ? '👁️ Showing only selected rows' : '👁️ Showing all rows');
    });
    
    return filterButton;
  }

  updateInfoSectionWithAnticipatedProgress() {
    if (!this.infoSection || !this.virtualScrolling) return;
    
    // Use max of totalRecords and actual loaded data to handle inconsistencies
    const total = Math.max(this.totalRecords, this.data.length);
    const currentLoaded = this.data.length;
    const filtered = this.filteredData.length;
    // Count only valid selected rows (detail records, not stale IDs)
    const selected = this.getValidSelectedCount();
    
    // Calculate anticipated progress (assume we'll get a full page of data)
    const anticipatedLoaded = Math.min(currentLoaded + this.pageSize, total);
    
    // Clear existing content
    this.infoSection.innerHTML = '';
    
    // Create container for first line with refresh button
    const firstLineContainer = document.createElement('div');
    firstLineContainer.className = 'info-line-container';
    
    // First line: Selection info (only show when there are selections)
    if (selected > 0) {
      const selectionLine = document.createElement('div');
      selectionLine.className = 'info-line';
      
      const selectionInfo = document.createElement('span');
      selectionInfo.className = 'info-selection';
      selectionInfo.textContent = `${selected} selected`;
      
      selectionLine.appendChild(selectionInfo);
      firstLineContainer.appendChild(selectionLine);
    }
    
    // Add auto-fetch button if enabled (only for virtual scrolling tables with more data to fetch)
    if (this.showAutoFetchButton && this.virtualScrolling && (this.hasMoreData || this.isAutoFetching)) {
      const autoFetchButton = this.createAutoFetchButton();
      
      // Disable button if paused (waiting for current page to complete)
      autoFetchButton.disabled = this.autoFetchPaused;
      
      firstLineContainer.appendChild(autoFetchButton);
    }
    
    // Add refresh button if enabled - show loading state during anticipated progress
    if (this.showRefreshButton) {
      const refreshButton = this.createRefreshButton();
      
      // During anticipated progress, we're loading, so show spinning state
      refreshButton.classList.add('refreshing');
      refreshButton.disabled = true;
      refreshButton.title = 'Loading data...';
      
      firstLineContainer.appendChild(refreshButton);
    }
    
    // Only add the container if it has content
    if (firstLineContainer.children.length > 0) {
      this.infoSection.appendChild(firstLineContainer);
    }
    
    // Second line: Stats with anticipated progress - smaller font
    const statsLine = document.createElement('div');
    statsLine.className = 'info-line secondary';
    
    const statsInfo = document.createElement('span');
    statsInfo.className = 'info-stats';
    
    let statsText = '';
    if (filtered < currentLoaded) {
      // Has filtering applied - show anticipated with current filter count
      if (anticipatedLoaded < total) {
        const loadPercentage = Math.round((anticipatedLoaded / total) * 100);
        statsText = `${filtered} filtered (${loadPercentage}% of ${total} total)`;
      } else {
        statsText = `${filtered} filtered (${total} total)`;
      }
    } else {
      // No filtering - show anticipated progress
      if (anticipatedLoaded < total) {
        const percentage = Math.round((anticipatedLoaded / total) * 100);
        statsText = `${percentage}% of ${total} total`;
      } else {
        statsText = `${total} total`;
      }
    }
    
    statsInfo.textContent = statsText;
    statsLine.appendChild(statsInfo);
    this.infoSection.appendChild(statsLine);
    
    // Third line: Visual progress bar with anticipated progress using existing createProgressBar
    this.createProgressBar(anticipatedLoaded, total, filtered);
  }

  // Public API methods
  applyQuery(query) {
    this.currentQuery = query;
    
    // Update Monaco editor value to match the applied query
    if (this.queryEditor?.editor) {
      const currentValue = this.queryEditor.editor.getValue();
      if (currentValue !== query) {
        this.queryEditor.editor.setValue(query);
      }
    }
    
    if (!query.trim()) {
      this.filteredData = [...this.data];
    } else {
      try {
        // Use QueryEngine like in smart-table for proper query parsing
        const filteredIds = this.queryEngine.filterObjects(query);
        this.filteredData = this.data.filter(obj => filteredIds.includes(obj[this.primaryKeyField]));
      } catch (error) {
        this.filteredData = [...this.data];
      }
    }
    
    this.render();
  }

  sort(field, direction) {
    // Check if this field is the currently grouped field
    const isGroupedField = this.groupByField && field === this.groupByField;
    
    if (isGroupedField) {
      // 4-state cycle for grouped fields: value-asc -> value-desc -> count-asc -> count-desc -> none
      if (this.sortColumn === field) {
        if (this.sortMode === 'value' && this.sortDirection === 'asc') {
          // State 1 -> State 2: value-asc to value-desc
          this.sortDirection = 'desc';
        } else if (this.sortMode === 'value' && this.sortDirection === 'desc') {
          // State 2 -> State 3: value-desc to count-asc
          this.sortMode = 'count';
          this.sortDirection = 'asc';
        } else if (this.sortMode === 'count' && this.sortDirection === 'asc') {
          // State 3 -> State 4: count-asc to count-desc
          this.sortDirection = 'desc';
        } else {
          // State 4 -> State 5: count-desc to none (clear sorting)
          this.sortColumn = null;
          this.sortDirection = 'asc';
          this.sortMode = 'value';
        }
      } else {
        // Start fresh cycle: begin with value-asc
        this.sortColumn = field;
        this.sortDirection = 'asc';
        this.sortMode = 'value';
      }
    } else {
      // Regular 2-state toggle for non-grouped fields: asc <-> desc
      if (this.sortColumn === field) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = field;
        this.sortDirection = direction || 'asc';
        this.sortMode = 'value'; // Reset to value mode for non-grouped fields
      }
    }
    
    this.render();
  }

  group(field) {
    // Validate that the field exists and is not hidden
    if (field) {
      const column = this.columns.find(col => col.field === field);
      if (!column) {
        console.warn(`DivTable: Cannot group by field '${field}' - field not found in columns`);
        return;
      }
      if (column.hidden) {
        console.warn(`DivTable: Cannot group by field '${field}' - hidden columns cannot be used for grouping`);
        return;
      }
      if (column.groupable === false) {
        console.warn(`DivTable: Cannot group by field '${field}' - column is marked as not groupable`);
        return;
      }
    }
    
    this.groupByField = field || null;
    
    if (field) {
      // When grouping is enabled, collapse/expand based on groupCollapsed option (default: collapsed)
      this.collapsedGroups.clear();
      
      if (this.groupCollapsed) {
        // Get all groups to populate the collapsed set
        const groups = this.groupData(this.filteredData);
        groups.forEach(group => {
          this.collapsedGroups.add(group.key);
        });
      }
    } else {
      // When grouping is disabled, clear collapsed groups
      this.collapsedGroups.clear();
    }
    
    this.render();
  }

  clearGrouping() {
    this.group(null);
  }

  addRecord(record) {
    if (!record || typeof record !== 'object') {
      console.warn('addRecord requires a valid record object');
      return false;
    }
    
    // Ensure the record has a primary key
    if (!record[this.primaryKeyField]) {
      console.warn(`addRecord: Record must have a ${this.primaryKeyField} field`);
      return false;
    }
    
    // Check for existing record with same primary key (upsert behavior)
    const recordId = String(record[this.primaryKeyField]);
    const existingIndex = this.data.findIndex(item => 
      String(item[this.primaryKeyField]) === recordId
    );
    
    if (existingIndex >= 0) {
      // Update existing record
      this.data[existingIndex] = { ...record };
      console.log(`addRecord: Updated existing record with ${this.primaryKeyField} '${recordId}'`);
    } else {
      // Add new record
      this.data.push(record);
      console.log(`addRecord: Added new record with ${this.primaryKeyField} '${recordId}'`);
    }
    
    // Clear loading state when record is added
    this.isLoadingState = false;
    
    // Update the query engine with new/updated data
    this.queryEngine.setObjects(this.data);
    
    // Update query editor if field values changed (for completion suggestions)
    this.updateQueryEditorIfNeeded();
    
    // Re-apply current filter to include new/updated record if it matches
    this.applyQuery(this.currentQuery);
    
    return true;
  }

  removeRecord(id) {
    if (id === undefined || id === null) {
      console.warn('removeRecord requires a valid ID');
      return false;
    }
    
    const recordId = String(id);
    const index = this.data.findIndex(item => 
      String(item[this.primaryKeyField]) === recordId
    );
    
    if (index >= 0) {
      const removedRecord = this.data[index];
      this.data.splice(index, 1);
      
      // Remove from selection if it was selected
      this.selectedRows.delete(recordId);
      
      // Update the query engine with updated data
      this.queryEngine.setObjects(this.data);
      
      // Update query editor if field values changed (for completion suggestions)
      this.updateQueryEditorIfNeeded();
      
      // Re-apply current filter
      this.applyQuery(this.currentQuery);
      
      return removedRecord;
    }
    
    console.warn(`removeRecord: Record with ${this.primaryKeyField} '${recordId}' not found`);
    return false;
  }

  getSelectedRows() {
    return Array.from(this.selectedRows).map(id => this.findRowData(id)).filter(Boolean);
  }

  /**
   * Get the count of selected rows that have valid data records
   * This excludes any stale selections (IDs that no longer exist in data)
   * @returns {number} The count of valid selected rows
   */
  getValidSelectedCount() {
    return this.getSelectedRows().length;
  }

  /**
   * Toggle the filter to show only selected rows or all rows
   * @param {boolean} [showOnlySelected] - Optional: explicitly set the filter state (true = show only selected, false = show all). If omitted, toggles current state.
   * @returns {boolean} The new filter state
   */
  toggleSelectedRowsFilter(showOnlySelected) {
    // If parameter provided, use it; otherwise toggle current state
    this.showOnlySelected = showOnlySelected !== undefined ? showOnlySelected : !this.showOnlySelected;
    
    // Re-render the table with the new filter
    this.render();
    
    console.log(this.showOnlySelected ? '👁️ Showing only selected rows' : '👁️ Showing all rows');
    
    return this.showOnlySelected;
  }

  /**
   * Programmatically trigger a refresh of the table data
   * This is the same functionality as clicking the refresh button
   * @returns {Promise<void>} Promise that resolves when refresh is complete
   */
  async refresh() {
    // Stop auto-fetch if it's running
    if (this.isAutoFetching) {
      this.stopAutoFetch();
    }
    
    try {
      // If this is a virtual scrolling table, reset and load first page
      if (this.virtualScrolling && typeof this.onNextPage === 'function') {
        
        // Preserve current filter/query and selections before resetting
        const preservedQuery = this.currentQuery;
        const preservedEditorValue = this.queryEditor?.editor ? this.queryEditor.editor.getValue() : '';
        const preservedSelections = new Set(this.selectedRows); // Preserve selections across refresh
        
        // Reset to loading state
        this.isLoadingState = true;
        this.data = [];
        this.filteredData = [];

        // Reset pagination state
        this.currentPage = 0;
        this.isLoading = true; // Set loading state before fetching
        this.hasMoreData = true;
        
        
        // Update the query engine with empty data
        this.queryEngine.setObjects([]);
        
        // Re-render to show loading state
        this.render();
        
        const firstPageToLoad = 0; // Start with page 0
        const firstPageData = await this.onNextPage(firstPageToLoad, this.pageSize);
        
        // Clear loading state
        this.isLoading = false;
        
        if (firstPageData && Array.isArray(firstPageData) && firstPageData.length > 0) {
          this.replaceData(firstPageData);
          
          // Restore preserved selections after data is replaced
          // Only keep selections that still exist in the new data
          this.selectedRows.clear();
          for (const selectedId of preservedSelections) {
            const stillExists = this.data.some(item => String(item[this.primaryKeyField]) === selectedId);
            if (stillExists) {
              this.selectedRows.add(selectedId);
            }
          }
          
          // Re-render to update UI with restored selections
          this.render();
        } else {
          // No data received, clear loading state
          this.isLoadingState = false;
          this.render();
        }
      } else {
        // For non-virtual scrolling tables, call the onRefresh callback if provided
        if (typeof this.onRefresh === 'function') {
          // Set loading state if showLoadingPlaceholder is enabled
          if (this.showLoadingPlaceholder) {
            this.isLoadingState = true;
            this.render(); // Show loading placeholder immediately
          }
          
          await Promise.resolve(this.onRefresh());
          
          // Clear loading state after onRefresh completes
          // (unless replaceData was called which already clears it)
          if (this.isLoadingState) {
            this.isLoadingState = false;
            this.render();
          }
        } else {
          console.log('ℹ️ Refresh: No onRefresh callback provided for non-virtual scrolling table');
        }
      }
    } catch (error) {
      console.error('❌ Refresh error:', error);
      // Clear loading state on error
      this.isLoadingState = false;
      this.render();
      throw error; // Re-throw so caller can handle the error
    }
  }

  // Helper method to update query editor when field values change
  updateQueryEditorIfNeeded() {
    if (!this.queryEditor || !this.queryEditor.editor) {
      return;
    }

    // Check if we need to update field values for completion suggestions
    // This is particularly important when starting with no data and then loading data
    if (this.data.length === 0) {
      return; // No data to analyze, keep current editor
    }

    // Get existing field names structure (defined at construction time)
    const currentFieldNames = this.queryEditor.editor.getFieldNames() || {};
    
    // Create a set of valid column fields (exclude computed fields like 'technical')
    const validFields = new Set(this.columns.filter(col => col.field).map(col => col.field));
    
    // Only keep fields that are in our column definitions
    const filteredCurrentFieldNames = {};
    Object.keys(currentFieldNames).forEach(field => {
      if (validFields.has(field)) {
        filteredCurrentFieldNames[field] = currentFieldNames[field];
      }
    });
    
    // Only update VALUES for existing fields, don't add new field definitions
    const updatedFieldNames = { ...filteredCurrentFieldNames };
    
    if (this.data.length > 0) {
      // Only iterate over fields defined in columns, not all data properties
      this.columns.forEach(col => {
        const field = col.field;
        if (!field) return; // Skip columns without field definitions
        
        // Only update if this field already exists in the filtered schema
        if (filteredCurrentFieldNames[field]) {
          const existingField = filteredCurrentFieldNames[field];
          
          // Use column type if defined, otherwise use existing field type
          const fieldType = col.type || existingField.type;
          
          // For string fields, merge new values with existing ones
          if (fieldType === 'string' && existingField.values !== undefined) {
            // Collect all values, flattening arrays
            const allValues = [];
            this.data.forEach(item => {
              const value = item[field];
              if (Array.isArray(value)) {
                // Flatten array values
                allValues.push(...value);
              } else {
                allValues.push(value);
              }
            });
            
            const uniqueValues = [...new Set(allValues)];
            const definedValues = uniqueValues.filter(value =>
              value !== null && value !== undefined && value !== ''
            );
            const hasUndefinedValues = uniqueValues.some(value =>
              value === null || value === undefined || value === ''
            );
            
            // Merge existing values with new values (union)
            const existingValues = existingField.values.filter(v => v !== 'NULL');
            const mergedValues = [...new Set([...existingValues, ...definedValues])];
            
            updatedFieldNames[field] = {
              type: fieldType,
              values: hasUndefinedValues ? [...mergedValues, 'NULL'] : mergedValues
            };
          } else {
            // For non-string fields (boolean, number), update the type but don't collect values
            updatedFieldNames[field] = {
              type: fieldType
            };
          }
        }
        // Note: We don't add new fields that weren't in the original schema
      });
    }

    // Compare with existing field names to see if update is needed
    const needsUpdate = this._shouldUpdateFieldNames(filteredCurrentFieldNames, updatedFieldNames);
    
    if (needsUpdate) {
      // Use dynamic update approach only - no fallback to recreation
      try {
        const success = this.queryEditor.editor.updateFieldNames(updatedFieldNames);
        
        if (!success) {
          console.warn('⚠️ Failed to update query editor field values - dynamic update not available');
        }
      } catch (error) {
        console.warn('⚠️ Error updating query editor field values:', error);
      }
    }
  }

  setupQueryEventHandlers() {
    // Clear any initial markers if the editor starts empty
    setTimeout(() => {
      const value = this.queryEditor.model?.getValue();
      if (value === '') {
        this.monaco.editor.setModelMarkers(this.queryEditor.model, this.queryEditor.model.getLanguageId(), []);
      }
    }, 10);

    // Set up proper query change handling
    if (this.queryEditor.model) {
      this.queryEditor.model.onDidChangeContent(() => {
        const query = this.queryEditor.model.getValue();
        this.handleQueryChange(query);
      });
    }

    // Set up additional query listeners with debouncing
    this._setupQueryListeners();
  }

  // Debug method to verify data consistency
  verifyDataConsistency() {
    const issues = [];
    
    // Check if all selectedRows exist in the data
    for (const selectedId of this.selectedRows) {
      const rowData = this.findRowData(selectedId);
      if (!rowData) {
        issues.push(`Selected row ${selectedId} not found in data`);
      }
    }
    
    // Check if all displayed rows have corresponding data
    const displayedRowIds = Array.from(this.bodyContainer.querySelectorAll('.div-table-row[data-id]'))
      .map(row => row.dataset.id);
    
    for (const displayedId of displayedRowIds) {
      const rowData = this.findRowData(displayedId);
      if (!rowData) {
        issues.push(`Displayed row ${displayedId} not found in data`);
      }
    }
    
    if (issues.length > 0) {
      console.warn('DivTable data consistency issues:', issues);
    }
    
    return issues.length === 0;
  }

  // Test method to verify group selection states
  testGroupSelectionStates() {
    if (!this.groupByField) {
      console.log('No grouping applied');
      return;
    }

    const groups = this.groupData(this.sortData(this.filteredData));
    console.log('Group selection states:');
    
    groups.forEach(group => {
      const groupItemIds = group.items.map(item => String(item[this.primaryKeyField]));
      const selectedInGroup = groupItemIds.filter(id => this.selectedRows.has(id));
      
      let state = 'none';
      if (selectedInGroup.length === groupItemIds.length) {
        state = 'all';
      } else if (selectedInGroup.length > 0) {
        state = 'partial';
      }
      
      console.log(`Group "${group.value}": ${selectedInGroup.length}/${groupItemIds.length} selected (${state})`);
    });
  }

  // Virtual Scrolling Methods
  handleVirtualScroll() {
    const scrollTop = this.bodyContainer.scrollTop;
    const scrollHeight = this.bodyContainer.scrollHeight;
    const clientHeight = this.bodyContainer.clientHeight;
    
    // Calculate current visible position and determine loading trigger
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    const currentDataLength = this.filteredData.length;
    
    // Calculate which record would be approximately visible at current scroll position
    const estimatedVisibleRecord = Math.floor(scrollPercentage * currentDataLength);
    
    // Calculate the trigger point: total records minus loading threshold
    const triggerPoint = currentDataLength - this.loadingThreshold;
    
    // Load next page when we're close to the end of currently loaded data
    if (estimatedVisibleRecord >= triggerPoint && this.hasMoreData && !this.isLoading) {
      this.loadNextPage();
    }
  }

  async loadNextPage() {
    if (this.isLoading || !this.hasMoreData) {
      return;
    }
    
    this.isLoading = true;
    
    // Step 1: Update InfoSection with loading state and show placeholders
    this.showLoadingPlaceholders();
    this.updateInfoSectionWithAnticipatedProgress();
    
    try {
      // Step 2: Trigger onNextPage
      const nextPageToLoad = this.currentPage + 1;
      const newData = await this.onNextPage(nextPageToLoad, this.pageSize);
      
      // Step 3: Stop loading status BEFORE appending data
      this.isLoading = false;
      this.hideLoadingPlaceholders();
      
      // Step 4: Append data (without triggering updateInfoSection inside)
      if (newData && Array.isArray(newData) && newData.length > 0) {
        const result = this.appendData(newData, true); // Pass skipInfoUpdate flag
        
        // Only increment page if we actually processed some data
        if (result.added > 0 || result.updated > 0) {
          this.currentPage = nextPageToLoad;
        }
        
        // Check if we have more data - improved logic to determine if current page is the last page
        if (this.totalRecords && this.totalRecords > 0) {
          // If we know the total number of records, check if we've loaded them all
          this.hasMoreData = this.data.length < this.totalRecords;
        } else {
          // Fallback to standard pagination logic: if we got less data than requested page size, we're at the end
          this.hasMoreData = newData.length === this.pageSize;
        }
        
        // Additional check: if we got fewer records than the page size, we're definitely at the end
        if (newData.length < this.pageSize) {
          this.hasMoreData = false;
        }
      } else {
        // No more data available
        this.hasMoreData = false;
      }
    } catch (error) {
      console.error('❌ Error loading next page:', error);
      this.isLoading = false;
      this.hideLoadingPlaceholders();
      this.showErrorIndicator();
    } finally {
      // Step 5: Always update infoSection to reflect final state (success or error)
      this.updateInfoSection();
    }
  }

  showErrorIndicator() {
    let indicator = this.bodyContainer.querySelector('.error-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'error-indicator';
      indicator.innerHTML = `
        <span>Error loading data. Please try again.</span>
        <button class="retry-button">Retry</button>
      `;
      
      const retryButton = indicator.querySelector('.retry-button');
      retryButton.addEventListener('click', () => {
        this.hideErrorIndicator();
        this.loadNextPage();
      });
      
      this.bodyContainer.appendChild(indicator);
    }
    indicator.style.display = 'flex';
  }

  hideErrorIndicator() {
    const indicator = this.bodyContainer.querySelector('.error-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  showLoadingPlaceholders() {
    // Only show placeholders if the option is enabled
    if (!this.showLoadingPlaceholder) {
      return;
    }
    
    // Remove any existing placeholders first
    this.hideLoadingPlaceholders();
    
    // Create placeholder rows for the expected page size
    const placeholdersToShow = 3; // Show max 3 placeholder rows to avoid overwhelming UI

    for (let i = 0; i < placeholdersToShow; i++) {
      const placeholderRow = this.createLoadingPlaceholderRow();
      this.bodyContainer.appendChild(placeholderRow);
    }
  }

  hideLoadingPlaceholders() {
    const placeholders = this.bodyContainer.querySelectorAll('.div-table-row.loading-placeholder');
    placeholders.forEach(placeholder => placeholder.remove());
  }

  createLoadingPlaceholderRow() {
    const row = document.createElement('div');
    row.className = 'div-table-row loading-placeholder';
    
    const orderedColumns = this.getOrderedColumns();
    
    // Use the same grid template as regular rows
    let gridTemplate = '';
    if (this.showCheckboxes) {
      gridTemplate = '40px '; // Checkbox column
    }
    
    // Add column templates
    orderedColumns.forEach(col => {
      // If this is the grouped column, make it narrower since values are empty
      if (this.groupByField && col.field === this.groupByField) {
        gridTemplate += '100px '; // Fixed narrow width for grouped column
        return;
      }
      
      const responsive = col.responsive || {};
      switch (responsive.size) {
        case 'fixed-narrow':
          gridTemplate += '80px ';
          break;
        case 'fixed-medium':
          gridTemplate += '120px ';
          break;
        case 'flexible-small':
          gridTemplate += '1fr ';
          break;
        case 'flexible-medium':
          gridTemplate += '2fr ';
          break;
        case 'flexible-large':
          gridTemplate += '3fr ';
          break;
        default:
          gridTemplate += '1fr ';
      }
    });
    
    row.style.gridTemplateColumns = gridTemplate.trim();

    // Checkbox column placeholder
    if (this.showCheckboxes) {
      const checkboxCell = document.createElement('div');
      checkboxCell.className = 'div-table-cell checkbox-column loading-cell';
      row.appendChild(checkboxCell);
    }

    // Column placeholders
    orderedColumns.forEach(col => {
      const cell = document.createElement('div');
      cell.className = 'div-table-cell loading-cell';
      
      // Create shimmer placeholder content
      const shimmerContent = document.createElement('div');
      shimmerContent.className = 'loading-shimmer-content';
      
      // Vary the width of placeholder content to look more realistic
      const widthPercentage = 60 + Math.random() * 30; // Between 60% and 90%
      shimmerContent.style.width = `${widthPercentage}%`;
      
      cell.appendChild(shimmerContent);
      row.appendChild(cell);
    });

    return row;
  }


  clearRefreshButtonLoadingState() {
    // Find refresh button and clear loading state
    if (this.showRefreshButton) {
      const refreshButton = this.infoSection.querySelector('.refresh-button');
      if (refreshButton) {
        refreshButton.classList.remove('refreshing');
        refreshButton.disabled = false;
        refreshButton.title = 'Refresh data';
      }
    }
  }

  // Public API for virtual scrolling configuration
  setTotalRecords(total) {
    if (typeof total !== 'number' || total < 0) {
      console.warn('DivTable: totalRecords must be a non-negative number');
      return;
    }
    
    this.totalRecords = total;
    this.hasMoreData = this.data.length < total;
    
    // Update info section to reflect new total
    this.updateInfoSection();
    
    console.log(`DivTable: Updated totalRecords to ${total}, hasMoreData: ${this.hasMoreData}`);
  }

  setPageSize(newPageSize) {
    if (typeof newPageSize !== 'number' || newPageSize <= 0) {
      console.warn('DivTable: pageSize must be a positive number');
      return;
    }
    
    const oldPageSize = this.pageSize;
    this.pageSize = newPageSize;
    
    // Recalculate loading threshold based on new page size
    this.loadingThreshold = Math.floor(this.pageSize * 0.8);
    
    // Update visible end index for virtual scrolling
    this.visibleEndIndex = Math.min(this.visibleStartIndex + this.pageSize, this.data.length);
    
    // Update info section to reflect new configuration
    this.updateInfoSection();
    
    console.log(`DivTable: Updated pageSize from ${oldPageSize} to ${newPageSize}, loadingThreshold: ${this.loadingThreshold}`);
  }

  setVirtualScrollingConfig({ totalRecords, pageSize, loadingThreshold }) {
    let updated = false;
    
    if (typeof totalRecords === 'number' && totalRecords >= 0) {
      this.totalRecords = totalRecords;
      this.hasMoreData = this.data.length < totalRecords;
      updated = true;
    }
    
    if (typeof pageSize === 'number' && pageSize > 0) {
      this.pageSize = pageSize;
      this.visibleEndIndex = Math.min(this.visibleStartIndex + this.pageSize, this.data.length);
      updated = true;
    }
    
    if (typeof loadingThreshold === 'number' && loadingThreshold > 0) {
      this.loadingThreshold = loadingThreshold;
      updated = true;
    } else if (typeof pageSize === 'number') {
      // Recalculate loading threshold if pageSize changed but threshold wasn't provided
      this.loadingThreshold = Math.floor(this.pageSize * 0.8);
      updated = true;
    }
    
    if (updated) {
      this.updateInfoSection();
      console.log(`DivTable: Updated virtual scrolling config - totalRecords: ${this.totalRecords}, pageSize: ${this.pageSize}, loadingThreshold: ${this.loadingThreshold}`);
    }
  }

  setHasMoreData(hasMore) {
    this.hasMoreData = hasMore;
  }

  resetPagination() {
    this.currentPage = 0;
    this.isLoading = false;
    this.hasMoreData = true;
    this.data = this.data.slice(0, this.pageSize); // Keep only first page
    this.filteredData = [...this.data];
    this.hideErrorIndicator();
    this.render();
  }

  appendData(newData, skipInfoUpdate = false) {
    if (!newData || !Array.isArray(newData)) {
      console.warn('appendData requires a valid array');
      return { added: 0, updated: 0, skipped: 0, invalid: [] };
    }
    
    const invalid = [];
    let addedCount = 0;
    let updatedCount = 0;
    
    // Process each record with upsert behavior
    for (const record of newData) {
      if (!record || typeof record !== 'object') {
        invalid.push(record);
        console.warn('appendData: Skipping invalid record', record);
        continue;
      }
      
      // Ensure the record has a primary key
      if (!record[this.primaryKeyField]) {
        invalid.push(record);
        console.warn(`appendData: Skipping record without ${this.primaryKeyField}`, record);
        continue;
      }
      
      // Check for existing record with same primary key (upsert behavior)
      const recordId = String(record[this.primaryKeyField]);
      const existingIndex = this.data.findIndex(item => 
        String(item[this.primaryKeyField]) === recordId
      );
      
      if (existingIndex >= 0) {
        this.data[existingIndex] = { ...record };
        updatedCount++;
      } else {
        this.data.push(record);
        addedCount++;
      }
    }
    
    if (addedCount > 0 || updatedCount > 0) {
      this.isLoadingState = false;
      
      // Update the query engine with new/updated data
      this.queryEngine.setObjects(this.data);
      
      // Update query editor if field values changed (for completion suggestions)
      this.updateQueryEditorIfNeeded();
      
      // Update filtered data if no active query
      if (!this.currentQuery.trim()) {
        this.filteredData = [...this.data];
      } else {
        // Re-apply query to include new/updated data
        this.applyQuery(this.currentQuery);
      }
      
      // Only update info section and re-render if not skipped
      // (loadNextPage will handle this after setting loading state correctly)
      if (!skipInfoUpdate) {
        this.updateInfoSection();
        this.render();
      } else {
        // Still need to render the data, just skip the info section update
        this.render();
      }
    }
    
    return { 
      added: addedCount, 
      updated: updatedCount, 
      skipped: invalid.length, 
      invalid 
    };
  }

  replaceData(newData) {
    if (!newData || !Array.isArray(newData)) {
      console.warn('replaceData requires a valid array');
      return { success: false, message: 'Invalid data provided' };
    }

    // Validate data integrity and check for duplicates within the new data
    const duplicates = [];
    const seenIds = new Set();
    const validRecords = [];
    
    for (const record of newData) {
      if (!record || typeof record !== 'object') {
        console.warn('replaceData: Skipping invalid record', record);
        continue;
      }
      
      // Ensure the record has a primary key
      if (!record[this.primaryKeyField]) {
        console.warn(`replaceData: Skipping record without ${this.primaryKeyField}`, record);
        continue;
      }
      
      // Check for duplicate primary key within the new data
      const recordId = String(record[this.primaryKeyField]);
      if (seenIds.has(recordId)) {
        duplicates.push(recordId);
        console.warn(`replaceData: Skipping duplicate ${this.primaryKeyField} '${recordId}' within new data`);
        continue;
      }
      
      seenIds.add(recordId);
      validRecords.push(record);
    }

    this.data = validRecords;
    this.isLoadingState = false;
    this.clearRefreshButtonLoadingState();
    
    this.queryEngine.setObjects(this.data);
    
    this.updateQueryEditorIfNeeded();
    
    if (this.currentQuery && this.currentQuery.trim()) {
      this.applyQuery(this.currentQuery);
    } else {
      this.filteredData = [...this.data];
    }
    
    this.selectedRows.clear();
    
    this.virtualScrollingState = {
      scrollTop: 0,
      displayStartIndex: 0,
      displayEndIndex: Math.min(this.pageSize, this.data.length),
      isLoading: false,
    };
    
    // Reset pagination to first page (zero-indexed)
    this.currentPage = 0;
    this.startId = 1;
    
    // Update hasMoreData flag based on whether we have less data than totalRecords
    if (this.virtualScrolling && this.totalRecords) {
      this.hasMoreData = validRecords.length < this.totalRecords;
    }
    
    // Update info display and re-render
    this.updateInfoSection();
    this.render();
    
    return { 
      success: true, 
      totalProvided: newData.length,
      validRecords: validRecords.length, 
      skipped: newData.length - validRecords.length, 
      duplicates 
    };
  }

  // Loading placeholder management
  resetToLoading() {
    this.isLoadingState = true;
    this.data = [];
    this.filteredData = [];
    this.selectedRows.clear();
    this.currentQuery = '';
    
    // Update Monaco editor if it exists
    if (this.queryEditor?.editor) {
      this.queryEditor.editor.setValue('');
    }
    
    // Update the query engine with empty data
    this.queryEngine.setObjects([]);
    
    // Re-render to show loading placeholder
    this.render();
  }

  setLoadingState(isLoading) {
    this.isLoadingState = Boolean(isLoading);
    this.render(); // Re-render to show/hide loading placeholder
  }

  // =====================================
  // Aggregate Summary Row Methods
  // =====================================

  /**
   * Check if any column has an aggregate defined
   * @returns {boolean} True if at least one column has aggregate property
   */
  hasAggregateColumns() {
    return this.columns.some(col => col.aggregate);
  }

  /**
   * Get columns that have aggregate functions defined
   * @returns {Array} Array of columns with aggregate property
   */
  getAggregateColumns() {
    return this.columns.filter(col => col.aggregate);
  }

  /**
   * Calculate aggregate value for a specific column and data set
   * @param {Object} column - Column definition with aggregate property
   * @param {Array} data - Array of data items to aggregate
   * @returns {number|null} Calculated aggregate value
   */
  calculateAggregate(column, data) {
    if (!column.aggregate || !data || data.length === 0) {
      return null;
    }

    const field = column.field;
    const aggregateType = column.aggregate.toLowerCase();
    
    // Extract numeric values from data
    const values = data
      .map(item => item[field])
      .filter(val => val !== null && val !== undefined && !isNaN(parseFloat(val)))
      .map(val => parseFloat(val));
    
    if (values.length === 0 && aggregateType !== 'count') {
      return null;
    }

    switch (aggregateType) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      
      case 'avg':
      case 'average':
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : null;
      
      case 'count':
        return data.length;
      
      case 'min':
        return values.length > 0 ? Math.min(...values) : null;
      
      case 'max':
        return values.length > 0 ? Math.max(...values) : null;
      
      default:
        console.warn(`DivTable: Unknown aggregate type '${aggregateType}' for column '${field}'`);
        return null;
    }
  }

  /**
   * Get the data set to use for aggregation, considering selection state
   * For header summary: all filtered data, or selected rows if any are selected
   * @param {Array} dataToRender - The currently displayed data
   * @returns {Array} Data set to use for aggregation
   */
  getAggregationDataSet(dataToRender) {
    // If there are selected rows, aggregate only selected rows
    if (this.selectedRows.size > 0) {
      return dataToRender.filter(item => {
        const itemId = String(item[this.primaryKeyField]);
        return this.selectedRows.has(itemId);
      });
    }
    // Otherwise aggregate all displayed data
    return dataToRender;
  }

  /**
   * Format aggregate value for display
   * @param {number|null} value - The aggregate value
   * @param {Object} column - Column definition
   * @returns {string} Formatted value string
   */
  formatAggregateValue(value, column) {
    if (value === null || value === undefined) {
      return '';
    }
    
    // Use column's render function if available for formatting
    // But only pass the value, not row data
    if (typeof column.aggregateRender === 'function') {
      return column.aggregateRender(value);
    }
    
    // Default formatting based on aggregate type
    const aggregateType = column.aggregate.toLowerCase();
    
    if (aggregateType === 'count') {
      return String(value);
    }
    
    // For numeric values, use locale formatting
    if (typeof value === 'number') {
      // Check if it's a decimal that needs precision
      if (aggregateType === 'avg' || aggregateType === 'average') {
        return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }
      return value.toLocaleString();
    }
    
    return String(value);
  }

  /**
   * Create the header summary row (grand total row below header)
   * @param {Array} dataToRender - Data to calculate aggregates from
   * @returns {HTMLElement} Summary row element
   */
  createHeaderSummaryRow(dataToRender) {
    const summaryRow = document.createElement('div');
    summaryRow.className = 'div-table-row summary-row header-summary';
    
    const compositeColumns = this.getCompositeColumns();
    const aggregationData = this.getAggregationDataSet(dataToRender);
    
    // Build grid template matching header
    let gridTemplate = '';
    if (this.showCheckboxes) {
      gridTemplate = '40px '; // Checkbox column
    }
    
    compositeColumns.forEach(composite => {
      const firstCol = composite.columns[0];
      const responsive = firstCol.responsive || {};
      switch (responsive.size) {
        case 'fixed-narrow': gridTemplate += '80px '; break;
        case 'fixed-medium': gridTemplate += '120px '; break;
        case 'flexible-small': gridTemplate += '1fr '; break;
        case 'flexible-medium': gridTemplate += '2fr '; break;
        case 'flexible-large': gridTemplate += '3fr '; break;
        default: gridTemplate += '1fr ';
      }
    });
    
    summaryRow.style.gridTemplateColumns = gridTemplate.trim();
    
    // Empty checkbox cell
    if (this.showCheckboxes) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'div-table-cell checkbox-column summary-cell';
      summaryRow.appendChild(emptyCell);
    }
    
    // Create cells for each composite column
    compositeColumns.forEach(composite => {
      const cell = document.createElement('div');
      cell.className = 'div-table-cell summary-cell';
      
      if (composite.compositeName) {
        // Composite column - check each sub-column for aggregates
        cell.classList.add('composite-cell');
        
        composite.columns.forEach((col, idx) => {
          const subCell = document.createElement('div');
          subCell.className = 'composite-sub-cell';
          
          if (col.aggregate) {
            const aggregateValue = this.calculateAggregate(col, aggregationData);
            const formattedValue = this.formatAggregateValue(aggregateValue, col);
            subCell.innerHTML = formattedValue;
            subCell.classList.add('aggregate-value');
            // Apply column alignment
            if (col.align) {
              subCell.style.textAlign = col.align;
            }
          }
          
          cell.appendChild(subCell);
        });
      } else {
        // Single column
        const col = composite.columns[0];
        
        // Apply column alignment
        if (col.align) {
          cell.style.textAlign = col.align;
          cell.style.justifyContent = col.align === 'right' ? 'flex-end' : 
                                       col.align === 'center' ? 'center' : 'flex-start';
        }
        
        if (col.aggregate) {
          const aggregateValue = this.calculateAggregate(col, aggregationData);
          const formattedValue = this.formatAggregateValue(aggregateValue, col);
          // Wrap in span for proper flex alignment
          const contentSpan = document.createElement('span');
          contentSpan.className = 'cell-content';
          contentSpan.innerHTML = formattedValue;
          cell.appendChild(contentSpan);
          cell.classList.add('aggregate-value');
        }
      }
      
      summaryRow.appendChild(cell);
    });
    
    return summaryRow;
  }

  /**
   * Create a group summary row (subtotal row after group items)
   * @param {Object} group - Group object with items array
   * @returns {HTMLElement} Group summary row element
   */
  createGroupSummaryRow(group) {
    const summaryRow = document.createElement('div');
    summaryRow.className = 'div-table-row summary-row group-summary';
    summaryRow.dataset.groupKey = group.key;
    
    const compositeColumns = this.getCompositeColumns();
    
    // For group summary, aggregate only the items in this group
    // But also respect selection: if items are selected, only aggregate selected items in this group
    let groupData = group.items;
    if (this.selectedRows.size > 0) {
      groupData = group.items.filter(item => {
        const itemId = String(item[this.primaryKeyField]);
        return this.selectedRows.has(itemId);
      });
    }
    
    // Build grid template matching body rows
    let gridTemplate = '';
    if (this.showCheckboxes) {
      gridTemplate = '40px ';
    }
    
    compositeColumns.forEach(composite => {
      const firstCol = composite.columns[0];
      const responsive = firstCol.responsive || {};
      switch (responsive.size) {
        case 'fixed-narrow': gridTemplate += '80px '; break;
        case 'fixed-medium': gridTemplate += '120px '; break;
        case 'flexible-small': gridTemplate += '1fr '; break;
        case 'flexible-medium': gridTemplate += '2fr '; break;
        case 'flexible-large': gridTemplate += '3fr '; break;
        default: gridTemplate += '1fr ';
      }
    });
    
    summaryRow.style.gridTemplateColumns = gridTemplate.trim();
    
    // Empty checkbox cell
    if (this.showCheckboxes) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'div-table-cell checkbox-column summary-cell';
      summaryRow.appendChild(emptyCell);
    }
    
    // Create cells for each composite column
    compositeColumns.forEach(composite => {
      const cell = document.createElement('div');
      cell.className = 'div-table-cell summary-cell';
      
      if (composite.compositeName) {
        cell.classList.add('composite-cell');
        
        composite.columns.forEach(col => {
          const subCell = document.createElement('div');
          subCell.className = 'composite-sub-cell';
          
          if (col.aggregate) {
            const aggregateValue = this.calculateAggregate(col, groupData);
            const formattedValue = this.formatAggregateValue(aggregateValue, col);
            subCell.innerHTML = formattedValue;
            subCell.classList.add('aggregate-value');
            // Apply column alignment
            if (col.align) {
              subCell.style.textAlign = col.align;
            }
          }
          
          cell.appendChild(subCell);
        });
      } else {
        const col = composite.columns[0];
        
        // Apply column alignment
        if (col.align) {
          cell.style.textAlign = col.align;
          cell.style.justifyContent = col.align === 'right' ? 'flex-end' : 
                                       col.align === 'center' ? 'center' : 'flex-start';
        }
        
        if (col.aggregate) {
          const aggregateValue = this.calculateAggregate(col, groupData);
          const formattedValue = this.formatAggregateValue(aggregateValue, col);
          // Wrap in span for proper flex alignment
          const contentSpan = document.createElement('span');
          contentSpan.className = 'cell-content';
          contentSpan.innerHTML = formattedValue;
          cell.appendChild(contentSpan);
          cell.classList.add('aggregate-value');
        }
      }
      
      summaryRow.appendChild(cell);
    });
    
    return summaryRow;
  }

  /**
   * Create header summary row pair for fixed columns layout
   * @param {Array} dataToRender - Data to calculate aggregates from
   * @returns {Object} Object with fixedSummary and scrollSummary elements
   */
  createHeaderSummaryRowWithFixedColumns(dataToRender) {
    const { fixedColumns, scrollColumns } = this.splitColumnsForFixedLayout();
    const aggregationData = this.getAggregationDataSet(dataToRender);
    
    // Fixed section summary row
    const fixedSummary = document.createElement('div');
    fixedSummary.className = 'div-table-row div-table-fixed-row summary-row header-summary';
    
    let fixedGridTemplate = '';
    if (this.showCheckboxes) {
      fixedGridTemplate = '40px ';
    }
    
    fixedColumns.forEach(composite => {
      fixedGridTemplate += this.getColumnGridSize(composite, true) + ' ';
    });
    
    fixedSummary.style.gridTemplateColumns = fixedGridTemplate.trim();
    
    // Empty checkbox cell in fixed section
    if (this.showCheckboxes) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'div-table-cell checkbox-column summary-cell';
      fixedSummary.appendChild(emptyCell);
    }
    
    // Fixed columns cells
    fixedColumns.forEach(composite => {
      const cell = this.createSummaryCell(composite, aggregationData);
      fixedSummary.appendChild(cell);
    });
    
    // Scroll section summary row
    const scrollSummary = document.createElement('div');
    scrollSummary.className = 'div-table-row summary-row header-summary';
    
    let scrollGridTemplate = '';
    scrollColumns.forEach(composite => {
      scrollGridTemplate += this.getColumnGridSize(composite) + ' ';
    });
    
    scrollSummary.style.gridTemplateColumns = scrollGridTemplate.trim();
    
    // Scroll columns cells
    scrollColumns.forEach(composite => {
      const cell = this.createSummaryCell(composite, aggregationData);
      scrollSummary.appendChild(cell);
    });
    
    return { fixedSummary, scrollSummary };
  }

  /**
   * Create group summary row pair for fixed columns layout
   * @param {Object} group - Group object with items array
   * @returns {Object} Object with fixedSummary and scrollSummary elements
   */
  createGroupSummaryRowWithFixedColumns(group) {
    const { fixedColumns, scrollColumns } = this.splitColumnsForFixedLayout();
    
    // Get data for this group, considering selection
    let groupData = group.items;
    if (this.selectedRows.size > 0) {
      groupData = group.items.filter(item => {
        const itemId = String(item[this.primaryKeyField]);
        return this.selectedRows.has(itemId);
      });
    }
    
    // Fixed section summary row
    const fixedSummary = document.createElement('div');
    fixedSummary.className = 'div-table-row div-table-fixed-row summary-row group-summary';
    fixedSummary.dataset.groupKey = group.key;
    
    let fixedGridTemplate = '';
    if (this.showCheckboxes) {
      fixedGridTemplate = '40px ';
    }
    
    fixedColumns.forEach(composite => {
      fixedGridTemplate += this.getColumnGridSize(composite, true) + ' ';
    });
    
    fixedSummary.style.gridTemplateColumns = fixedGridTemplate.trim();
    
    // Empty checkbox cell
    if (this.showCheckboxes) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'div-table-cell checkbox-column summary-cell';
      fixedSummary.appendChild(emptyCell);
    }
    
    // Fixed columns cells
    fixedColumns.forEach(composite => {
      const cell = this.createSummaryCell(composite, groupData);
      fixedSummary.appendChild(cell);
    });
    
    // Scroll section summary row
    const scrollSummary = document.createElement('div');
    scrollSummary.className = 'div-table-row summary-row group-summary';
    scrollSummary.dataset.groupKey = group.key;
    
    let scrollGridTemplate = '';
    scrollColumns.forEach(composite => {
      scrollGridTemplate += this.getColumnGridSize(composite) + ' ';
    });
    
    scrollSummary.style.gridTemplateColumns = scrollGridTemplate.trim();
    
    // Scroll columns cells
    scrollColumns.forEach(composite => {
      const cell = this.createSummaryCell(composite, groupData);
      scrollSummary.appendChild(cell);
    });
    
    return { fixedSummary, scrollSummary };
  }

  /**
   * Create a summary cell for a composite column
   * @param {Object} composite - Composite column definition
   * @param {Array} data - Data to aggregate
   * @returns {HTMLElement} Cell element
   */
  createSummaryCell(composite, data) {
    const cell = document.createElement('div');
    cell.className = 'div-table-cell summary-cell';
    
    if (composite.compositeName) {
      cell.classList.add('composite-cell');
      
      composite.columns.forEach(col => {
        const subCell = document.createElement('div');
        subCell.className = 'composite-sub-cell';
        
        if (col.aggregate) {
          const aggregateValue = this.calculateAggregate(col, data);
          const formattedValue = this.formatAggregateValue(aggregateValue, col);
          subCell.innerHTML = formattedValue;
          subCell.classList.add('aggregate-value');
          // Apply column alignment
          if (col.align) {
            subCell.style.textAlign = col.align;
          }
        }
        
        cell.appendChild(subCell);
      });
    } else {
      const col = composite.columns[0];
      
      // Apply column alignment to summary cell
      if (col.align) {
        cell.style.textAlign = col.align;
        cell.style.justifyContent = col.align === 'right' ? 'flex-end' : 
                                     col.align === 'center' ? 'center' : 'flex-start';
      }
      
      if (col.aggregate) {
        const aggregateValue = this.calculateAggregate(col, data);
        const formattedValue = this.formatAggregateValue(aggregateValue, col);
        // Wrap in span for proper flex alignment
        const contentSpan = document.createElement('span');
        contentSpan.className = 'cell-content';
        contentSpan.innerHTML = formattedValue;
        cell.appendChild(contentSpan);
        cell.classList.add('aggregate-value');
      }
    }
    
    return cell;
  }

  /**
   * Update all summary rows (called when selection changes)
   * Re-calculates aggregates based on current selection state
   */
  updateSummaryRows() {
    if (!this.hasAggregateColumns()) return;
    if (!this.showHeaderSummary && !this.showGroupSummary) return;
    
    // Get current data to render
    let dataToRender = this.filteredData;
    if (this.showOnlySelected && this.selectedRows.size > 0) {
      dataToRender = this.filteredData.filter(item => {
        const itemId = String(item[this.primaryKeyField]);
        return this.selectedRows.has(itemId);
      });
    }
    
    const aggregationData = this.getAggregationDataSet(dataToRender);
    
    // Update header summary row
    if (this.showHeaderSummary) {
      this.updateHeaderSummaryValues(aggregationData);
    }
    
    // Update group summary rows
    if (this.showGroupSummary && this.groupByField) {
      this.updateGroupSummaryValues(dataToRender);
    }
  }

  /**
   * Update aggregate values in the header summary row
   * @param {Array} aggregationData - Data to aggregate
   */
  updateHeaderSummaryValues(aggregationData) {
    const summaryRows = this.fixedColumns > 0
      ? [
          this.fixedBodyContainer?.querySelector('.header-summary'),
          this.scrollBodyContainer?.querySelector('.header-summary')
        ].filter(Boolean)
      : [this.bodyContainer?.querySelector('.header-summary')].filter(Boolean);
    
    summaryRows.forEach(summaryRow => {
      const aggregateCells = summaryRow.querySelectorAll('.aggregate-value');
      const aggregateColumns = this.getAggregateColumns();
      
      aggregateCells.forEach((cell, index) => {
        if (aggregateColumns[index]) {
          const col = aggregateColumns[index];
          const aggregateValue = this.calculateAggregate(col, aggregationData);
          const formattedValue = this.formatAggregateValue(aggregateValue, col);
          cell.innerHTML = formattedValue;
        }
      });
    });
  }

  /**
   * Update aggregate values in all group summary rows
   * @param {Array} dataToRender - Current displayed data
   */
  updateGroupSummaryValues(dataToRender) {
    const groups = this.groupData(dataToRender);
    
    groups.forEach(group => {
      let groupData = group.items;
      if (this.selectedRows.size > 0) {
        groupData = group.items.filter(item => {
          const itemId = String(item[this.primaryKeyField]);
          return this.selectedRows.has(itemId);
        });
      }
      
      const groupSummaries = this.fixedColumns > 0
        ? [
            this.fixedBodyContainer?.querySelector(`.group-summary[data-group-key="${group.key}"]`),
            this.scrollBodyContainer?.querySelector(`.group-summary[data-group-key="${group.key}"]`)
          ].filter(Boolean)
        : [this.bodyContainer?.querySelector(`.group-summary[data-group-key="${group.key}"]`)].filter(Boolean);
      
      groupSummaries.forEach(summaryRow => {
        const aggregateCells = summaryRow.querySelectorAll('.aggregate-value');
        const aggregateColumns = this.getAggregateColumns();
        
        aggregateCells.forEach((cell, index) => {
          if (aggregateColumns[index]) {
            const col = aggregateColumns[index];
            const aggregateValue = this.calculateAggregate(col, groupData);
            const formattedValue = this.formatAggregateValue(aggregateValue, col);
            cell.innerHTML = formattedValue;
          }
        });
      });
    });
  }
}

// QueryEngine class for advanced query functionality
class QueryEngine {
  constructor(objects = [], primaryKeyField = 'id') {
    this.objects = objects;
    this.primaryKeyField = primaryKeyField;
  }

  setObjects(objects) {
    this.objects = objects;
  }
 
  filterObjects(query) {
    if (!query.trim()) return this.objects.map(obj => obj[this.primaryKeyField]);

    const hasOperators = /[=!<>()]|(\bAND\b|\bOR\b|\bIN\b)/i.test(query);

    if (!hasOperators) {
      return this.searchObjects(query);
    }

    const results = [];
    for (const obj of this.objects) {
      try {
        if (this.evaluateExpression(obj, query)) {
          results.push(obj[this.primaryKeyField]);
        }
      } catch (error) {
        throw new Error(`Query error: ${error.message}`);
      }
    }
    return results;
  }

  searchObjects(searchTerms) {
    const terms = searchTerms.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return this.objects.map(obj => obj[this.primaryKeyField]);

    const results = [];
    for (const obj of this.objects) {
      const searchableValues = Object.values(obj)
        .map(value => (value == null ? '' : String(value).toLowerCase()))
        .join(' ');

      const allTermsFound = terms.every(term => searchableValues.includes(term));
      if (allTermsFound) results.push(obj[this.primaryKeyField]);
    }
    return results;
  }

  evaluateExpression(obj, expression) {
    if (!expression.trim()) return true;

    expression = expression.replace(/\s+/g, ' ').trim();

    while (/\(([^()]+)\)/.test(expression)) {
      expression = expression.replace(/\(([^()]+)\)/g, (_, innerExpr) =>
        this.processGroup(obj, innerExpr) ? 'true' : 'false'
      );
    }

    return this.processGroup(obj, expression);
  }

  processGroup(obj, group) {
    const orConditions = group.split(/\s+OR\s+/);

    return orConditions.some(conditionGroup => {
      const andConditions = conditionGroup.split(/\s+AND\s+/);

      return andConditions.every(condition => {
        const cond = condition.trim().toLowerCase();
        if (cond === 'false') return false;
        if (cond === 'true') return true;

        try {
          const parsed = this.parseCondition(condition);
          return this.applyCondition(obj, parsed);
        } catch {
          throw new Error(`Invalid condition: ${condition}`);
        }
      });
    });
  }

  parseCondition(condition) {
    const inMatch = condition.match(/(\w+)\s+IN\s+\[([^\]]+)\]/);
    if (inMatch) {
      const [, field, values] = inMatch;
      return {
        field,
        operator: 'IN',
        value: values.split(',').map(v => {
          const trimmed = v.trim().replace(/"/g, '');
          return trimmed === 'NULL' ? null : trimmed;
        })
      };
    }

    const match = condition.match(/(\w+)\s*(=|!=|>=|<=|>|<)\s*(.+)/i);
    if (match) {
      const [, field, operator, value] = match;
      let parsedValue = value.trim();

      if (parsedValue.startsWith('"') && parsedValue.endsWith('"')) {
        parsedValue = parsedValue.slice(1, -1);
      } else if (parsedValue === 'NULL') {
        parsedValue = null;
      } else if (parsedValue.toLowerCase() === 'true') {
        parsedValue = true;
      } else if (parsedValue.toLowerCase() === 'false') {
        parsedValue = false;
      } else if (!isNaN(parsedValue) && parsedValue !== '') {
        parsedValue = parseFloat(parsedValue);
      }

      return { field, operator, value: parsedValue };
    }

    throw new Error(`Invalid condition: ${condition}`);
  }

  applyCondition(obj, { field, operator, value }) {
    const objValue = field in obj ? obj[field] : null;
    const isNullish = val => val === null || val === undefined || val === '';

    switch (operator) {
      case '=':
        if (value === null) return isNullish(objValue);
        if (isNullish(objValue)) return false;
        // Handle array fields: check if the array contains the value
        if (Array.isArray(objValue)) {
          return objValue.includes(value);
        }
        return objValue == value;

      case '!=':
        if (value === null) return !isNullish(objValue);
        if (isNullish(objValue)) return true;
        // Handle array fields: check if the array does NOT contain the value
        if (Array.isArray(objValue)) {
          return !objValue.includes(value);
        }
        return objValue != value;

      case '>':
        if (isNullish(objValue)) return false;
        // Arrays don't support > comparison
        if (Array.isArray(objValue)) return false;
        return objValue > parseFloat(value);

      case '<':
        if (isNullish(objValue)) return false;
        // Arrays don't support < comparison
        if (Array.isArray(objValue)) return false;
        return objValue < parseFloat(value);

      case '>=':
        if (isNullish(objValue)) return false;
        // Arrays don't support >= comparison
        if (Array.isArray(objValue)) return false;
        return objValue >= parseFloat(value);

      case '<=':
        if (isNullish(objValue)) return false;
        // Arrays don't support <= comparison
        if (Array.isArray(objValue)) return false;
        return objValue <= parseFloat(value);

      case 'IN':
        if (value.includes(null)) {
          return isNullish(objValue) || value.includes(objValue);
        }
        if (isNullish(objValue)) return false;
        // Handle array fields: check if any element in objValue array is in the value list
        if (Array.isArray(objValue)) {
          return objValue.some(item => value.includes(item));
        }
        return value.includes(objValue);

      default:
        return false;
    }
  }
}

// Export for Node.js/Jest testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DivTable, QueryEngine };
}
