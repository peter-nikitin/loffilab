//= partials/owl.carousel.js
//= partials/fotorama.js

var maxHeight = window.innerHeight;

$('.fotorama').fotorama({
  width: '100%',
  maxwidth: '100%',
  ratio: 16/9,
  allowfullscreen: true,
  maxheight: maxHeight
});

$('.owl-carousel').owlCarousel({
    nav:true,
    responsive:{
        0:{
            items:1
        },
        600:{
            items:3
        },
        1000:{
            items:5
        }
    }
});

$('#orderModal').on('shown.bs.modal', function () {
  $('#orderName').focus()
})
