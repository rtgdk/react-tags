import PropTypes from "prop-types";
import React from "react";
import { DragDropContext } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import Suggestions from "./Suggestions";
import Tag from "./Tag";

// Constants
const Keys = {
  ENTER: 13,
  TAB: 9,
  BACKSPACE: 8,
  UP_ARROW: 38,
  DOWN_ARROW: 40,
  ESCAPE: 27,
};

const DefaultClassNames = {
  tags: "ReactTags__tags",
  tagInput: "ReactTags__tagInput",
  tagInputField: "ReactTags__tagInputField",
  selected: "ReactTags__selected",
  tag: "ReactTags__tag",
  remove: "ReactTags__remove",
  suggestions: "ReactTags__suggestions",
  tagLabel: "ReactTags__tagLabel",
};

class ReactTags extends React.Component {
  static propTypes = {
    tags: PropTypes.array,
    placeholder: PropTypes.string,
    labelField: PropTypes.string,
    suggestions: PropTypes.array,
    delimiters: PropTypes.array,
    autofocus: PropTypes.bool,
    inline: PropTypes.bool,
    handleDelete: PropTypes.func.isRequired,
    handleBeforeDelete: PropTypes.func,
    handleAddition: PropTypes.func.isRequired,
    handleBeforeAddition: PropTypes.func,
    handleDrag: PropTypes.func,
    handleFilterSuggestions: PropTypes.func,
    allowDeleteFromEmptyInput: PropTypes.bool,
    handleInputChange: PropTypes.func,
    handleInputBlur: PropTypes.func,
    minQueryLength: PropTypes.number,
    shouldRenderSuggestions: PropTypes.func,
    removeComponent: PropTypes.func,
    autocomplete: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
    readOnly: PropTypes.bool,
    classNames: PropTypes.object,
    handleTagClick: PropTypes.func,
    tagRenderer: PropTypes.func,
    suggestionsRenderer: PropTypes.func,
  };

  static defaultProps = {
    placeholder: "Add new tag",
    tags: [],
    suggestions: [],
    delimiters: [Keys.ENTER, Keys.TAB],
    autofocus: true,
    inline: true,
    allowDeleteFromEmptyInput: true,
    minQueryLength: 2,
    autocomplete: false,
    readOnly: false,
    handleTagClick: () => {},
    handleBeforeDelete: () => true,
    handleBeforeAddition: () => true,
  };

  state = {
    suggestions: this.props.suggestions,
    query: "",
    selectedIndex: -1,
    selectionMode: false,
  };

  componentWillMount() {
    this.setState({
      classNames: { ...DefaultClassNames, ...this.props.classNames },
    });
  }

  componentDidMount() {
    if (this.props.autofocus && !this.props.readOnly) {
      this.refs.input.focus();
    }
  }

  filteredSuggestions = (query, suggestions) => {
    if (this.props.handleFilterSuggestions) {
      return this.props.handleFilterSuggestions(query, suggestions);
    }

    return suggestions.filter(function(item) {
      return (
        (Object.prototype.toString.call(item) === "[object Object]"
          ? item.text
          : item
        )
          .toLowerCase()
          .indexOf(query.toLowerCase()) >= 0
      );
    });
  };

  componentWillReceiveProps(props) {
    var suggestions = this.filteredSuggestions(
      this.state.query,
      props.suggestions
    );
    this.setState({
      suggestions: suggestions,
      classNames: { ...DefaultClassNames, ...props.classNames },
    });
  }

  handleDelete = i => {
    const { handleBeforeDelete, handleDelete } = this.props;
    const allowTagDelete = handleBeforeDelete(i);
    if (!allowTagDelete) return;
    handleDelete(i);
    this.setState({ query: "" });
  };

  handleChange = e => {
    var str = e.target.value;
    while (str.indexOf("  ") !== -1) {
      str = str.replace(/  /g, " ");
    }
    if (str.indexOf(" ") === 0) {
      str = str.replace(/ /, "");
    }
    if (this.props.handleInputChange) {
      this.props.handleInputChange(str);
    }

    var query = str;
    var suggestions = this.filteredSuggestions(query, this.props.suggestions);
    var selectedIndex = this.state.selectedIndex;
    // if our selected entry is gonna disappear, select the last entry we will have
    if (selectedIndex >= suggestions.length) {
      selectedIndex = suggestions.length - 1;
    }
    this.setState({
      query: query,
      suggestions: suggestions,
      selectedIndex: selectedIndex,
    });
  };

  handleBlur = e => {
    var value = e.target.value.trim();
    if (this.props.handleInputBlur) {
      this.props.handleInputBlur(value);
      this.refs.input.value = "";
    }
  };

  handleKeyDown = e => {
    var { query, selectedIndex, suggestions } = this.state;

    // hide suggestions menu on escape
    if (e.keyCode === Keys.ESCAPE) {
      e.preventDefault();
      e.stopPropagation();
      this.setState({
        selectedIndex: -1,
        selectionMode: false,
        suggestions: [],
      });
    }

    // When one of the terminating keys is pressed, add current query to the tags.
    // If no text is typed in so far, ignore the action - so we don't end up with a terminating
    // character typed in.
    if (this.props.delimiters.indexOf(e.keyCode) !== -1 && !e.shiftKey) {
      if (e.keyCode !== Keys.TAB || query !== "") {
        e.preventDefault();
      }

      if (query !== "") {
        if (this.state.selectionMode && this.state.selectedIndex != -1) {
          query = this.state.suggestions[this.state.selectedIndex];
        }
        this.addTag(query);
      }
    }

    // when backspace key is pressed and query is blank, delete tag
    if (
      e.keyCode === Keys.BACKSPACE &&
      query == "" &&
      this.props.allowDeleteFromEmptyInput
    ) {
      this.handleDelete(this.props.tags.length - 1);
    }

    // up arrow
    if (e.keyCode === Keys.UP_ARROW) {
      e.preventDefault();
      var selectedIndex = this.state.selectedIndex;
      // last item, cycle to the top
      if (selectedIndex <= 0) {
        this.setState({
          selectedIndex: this.state.suggestions.length - 1,
          selectionMode: true,
        });
      } else {
        this.setState({
          selectedIndex: selectedIndex - 1,
          selectionMode: true,
        });
      }
    }

    // down arrow
    if (e.keyCode === Keys.DOWN_ARROW) {
      e.preventDefault();
      this.setState({
        selectedIndex: (this.state.selectedIndex + 1) % suggestions.length,
        selectionMode: true,
      });
    }
  };

  handlePaste = e => {
    e.preventDefault();

    // See: http://stackoverflow.com/a/6969486/1463681
    const escapeRegex = str =>
      str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");

    // Used to determine how the pasted content is split.
    const delimiterChars = escapeRegex(
      this.props.delimiters
        .map(delimiter => {
          // See: http://stackoverflow.com/a/34711175/1463681
          const chrCode = delimiter - 48 * Math.floor(delimiter / 48);
          return String.fromCharCode(96 <= delimiter ? chrCode : delimiter);
        })
        .join("")
    );

    const clipboardData = e.clipboardData || window.clipboardData;
    const string = clipboardData.getData("text");
    const regExp = new RegExp(`[${delimiterChars}]+`);
    string
      .split(regExp)
      .forEach(
        tag =>
          this.props.handleInputChange
            ? this.handleChange({ target: { value: string } })
            : this.props.handleAddition(tag)
      );
  };

  addTag = tag => {
    const {
      handleBeforeAddition,
      autocomplete,
      suggestions,
      handleAddition,
    } = this.props;
    let { input } = this.refs;

    if (autocomplete) {
      const possibleMatches = this.filteredSuggestions(tag, suggestions);

      if (
        (autocomplete === 1 && possibleMatches.length === 1) ||
        (autocomplete === true && possibleMatches.length)
      ) {
        tag = possibleMatches[0];
      }
    }
    const allowTagAddition = handleBeforeAddition(tag);
    if (!allowTagAddition) {
      return;
    }

    // call method to add
    handleAddition(tag);

    // reset the state
    this.setState({
      query: "",
      selectionMode: false,
      selectedIndex: -1,
    });

    // focus back on the input box
    input.value = "";
    input.focus();
  };

  handleSuggestionClick = (i, e) => {
    this.addTag(this.state.suggestions[i]);
  };

  handleSuggestionHover = (i, e) => {
    this.setState({
      selectedIndex: i,
      selectionMode: true,
    });
  };

  moveTag = (id, afterId) => {
    var tags = this.props.tags;

    // locate tags
    var tag = tags.filter(t => t.id === id)[0];
    var afterTag = tags.filter(t => t.id === afterId)[0];

    // find their position in the array
    var tagIndex = tags.indexOf(tag);
    var afterTagIndex = tags.indexOf(afterTag);

    // call handler with current position and after position
    this.props.handleDrag(tag, tagIndex, afterTagIndex);
  };

  render() {
    var moveTag = this.props.handleDrag ? this.moveTag : null;
    var tagItems = this.props.tags.map(
      function(tag, i) {
        return (
          <Tag
            key={i}
            tag={tag}
            labelField={this.props.labelField}
            onDelete={this.handleDelete.bind(this, i)}
            moveTag={moveTag}
            removeComponent={this.props.removeComponent}
            readOnly={this.props.readOnly}
            classNames={this.state.classNames}
            tagRenderer={this.props.tagRenderer}
            handleTagClick={this.props.handleTagClick}
          />
        );
      }.bind(this)
    );

    // get the suggestions for the given query
    var query = this.state.query.trim(),
      selectedIndex = this.state.selectedIndex,
      suggestions = this.state.suggestions,
      placeholder = this.props.placeholder;

    const tagInput = !this.props.readOnly ? (
      <div className={this.state.classNames.tagInput}>
        <input
          ref="input"
          className={this.state.classNames.tagInputField}
          type="text"
          placeholder={placeholder}
          aria-label={placeholder}
          onBlur={this.handleBlur}
          value={this.state.query}
          onChange={this.handleChange}
          onKeyDown={this.handleKeyDown}
          onPaste={this.handlePaste}
        />

        <Suggestions
          query={query}
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          handleClick={this.handleSuggestionClick}
          handleHover={this.handleSuggestionHover}
          minQueryLength={this.props.minQueryLength}
          shouldRenderSuggestions={this.props.shouldRenderSuggestions}
          suggestionsRenderer={this.props.suggestionsRenderer}
          classNames={this.state.classNames}
        />
      </div>
    ) : null;

    return (
      <div className={this.state.classNames.tags}>
        <div className={this.state.classNames.selected}>
          {tagItems}
          {this.props.inline && tagInput}
        </div>
        {!this.props.inline && tagInput}
      </div>
    );
  }
}

module.exports = {
  WithContext: DragDropContext(HTML5Backend)(ReactTags),
  WithOutContext: ReactTags,
  Keys: Keys,
};
