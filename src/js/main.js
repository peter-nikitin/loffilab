

var mainNavbar = $('#mainNavbar'),
    toggler = $('.toggler'),
    togglerTarget = $('.collapse');


toggler.on('click', function(){
        if(mainNavbar.hasClass("show")) {
            mainNavbar.removeClass('show');
            console.log ("class remover");
        } else {
            mainNavbar.addClass("show");
            console.log("class added");
        }
    });
 